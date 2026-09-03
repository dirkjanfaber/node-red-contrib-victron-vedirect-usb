const { PassThrough } = require('stream')

// A stand-in for SerialPort: a readable stream that can be fed bytes and can
// replay the lifecycle events the real driver emits (open, close, end, error).
class MockSerialPort extends PassThrough {
  constructor (options) {
    super()
    this.options = options
    this.isOpen = false
    this.opening = true
    MockSerialPort.instances.push(this)
  }

  open () {
    this.isOpen = true
    this.opening = false
    this.emit('open')
  }

  // The driver flips isOpen before it awaits the fd release, and only emits
  // 'close' once the descriptor is actually gone.
  beginSlowClose () {
    this.isOpen = false
    this.closing = true
  }

  close (callback) {
    if (!this.isOpen) {
      return process.nextTick(() => callback && callback(new Error('Port is not open')))
    }
    this.isOpen = false
    process.nextTick(() => callback && callback(null))
  }

  disconnect () {
    this.isOpen = false
    const err = new Error('device disconnected')
    err.disconnected = true
    this.emit('close', err)
  }
}

MockSerialPort.instances = []

jest.mock('serialport', () => ({ SerialPort: MockSerialPort }))

const VEDirect = require('../../../src/services/vedirect')
const { toWireFrame, smartShuntFrame } = require('../../fixtures/vedirect-frames')

const VALID_FRAME = toWireFrame(smartShuntFrame)

describe('VEDirect', () => {
  let port

  beforeEach(() => {
    MockSerialPort.instances = []
  })

  function build () {
    const reader = new VEDirect('/dev/ttyUSB0')
    port = MockSerialPort.instances[MockSerialPort.instances.length - 1]
    return reader
  }

  it('should open the configured path at the VE.Direct baud rate', () => {
    build()
    expect(port.options).toMatchObject({ path: '/dev/ttyUSB0', baudRate: 19200 })
  })

  it('should emit open when the port opens', () => {
    const reader = build()
    const onOpen = jest.fn()
    reader.on('open', onOpen)

    port.open()

    expect(onOpen).toHaveBeenCalled()
    expect(reader.state).toBe(VEDirect.OPEN)
  })

  it('should stay open when the port errors after opening', () => {
    const reader = build()
    reader.on('error', () => {})
    port.open()

    port.emit('error', new Error('parity'))

    expect(reader.state).toBe(VEDirect.OPEN)
  })

  // A zero-byte read ends the stream but leaves the descriptor held, and
  // serialport opens Linux ports with TIOCEXCL, so failing to close it here
  // makes every later open on the same path fail to lock.
  it('should still release the descriptor after the stream ends', (done) => {
    const reader = build()
    port.open()

    reader.on('close', () => {
      expect(reader.state).toBe(VEDirect.LOST)
      expect(port.isOpen).toBe(true)

      reader.close(() => {
        expect(port.isOpen).toBe(false)
        expect(reader.state).toBe(VEDirect.CLOSED)
        done()
      })
    })

    port.end()
  })

  it('should not re-close a port the driver already released', (done) => {
    const reader = build()
    port.open()
    let closeCalls = 0
    const realClose = port.close.bind(port)
    port.close = (callback) => { closeCalls++; realClose(callback) }

    reader.on('close', () => {
      reader.close(() => {
        expect(closeCalls).toBe(0)
        done()
      })
    })

    port.disconnect()
  })

  it('should wait for a close the driver already started', (done) => {
    const reader = build()
    port.open()
    port.beginSlowClose()

    let settled = false
    reader.close(() => { settled = true })

    setImmediate(() => {
      expect(settled).toBe(false)
      port.closing = false
      port.emit('close')
      setImmediate(() => {
        expect(settled).toBe(true)
        done()
      })
    })
  })

  // A close the driver started itself reports failure by emitting 'error' and
  // never emits 'close' at all, so waiting only for 'close' hangs forever and
  // takes Node-RED's shutdown with it.
  it('should settle when a close the driver started fails', (done) => {
    const reader = build()
    port.open()
    port.beginSlowClose()

    reader.close((err) => {
      expect(err.message).toBe('EIO')
      expect(reader.state).toBe(VEDirect.CLOSED)
      done()
    })

    setImmediate(() => {
      port.closing = false
      port.emit('error', new Error('EIO'))
    })
  })

  // removeAllListeners stops our own events, but bytes still flowing through
  // the pipe chain keep the parser and its buffers alive on a dead reader.
  it('should stop the byte flow, not just the events, on close', (done) => {
    const reader = build()
    port.open()

    reader.close(() => {
      const parsed = []
      reader.ve.on('data', (frame) => parsed.push(frame))

      port.write(VALID_FRAME)

      setImmediate(() => {
        expect(parsed).toEqual([])
        done()
      })
    })
  })

  it('should detach a reader whose open failed', (done) => {
    const reader = build()
    reader.on('error', () => {})
    port.emit('error', new Error('ENOENT'))

    expect(reader.state).toBe(VEDirect.CLOSED)

    reader.close(() => {
      const parsed = []
      reader.ve.on('data', (frame) => parsed.push(frame))

      port.isOpen = true
      port.write(VALID_FRAME)

      setImmediate(() => {
        expect(parsed).toEqual([])
        done()
      })
    })
  })

  // The reader can be LOST (the stream ended) while the driver's open is still
  // in flight; declaring the descriptor free then would leak it.
  it('should wait for an open the driver has not finished', (done) => {
    const reader = build()
    port.open()

    reader.on('close', () => {
      // Back to opening, as a reopen would leave it.
      port.isOpen = false
      port.opening = true

      let settled = false
      reader.close(() => { settled = true })

      setImmediate(() => {
        expect(settled).toBe(false)
        port.open()
        setImmediate(() => {
          expect(settled).toBe(true)
          expect(port.isOpen).toBe(false)
          done()
        })
      })
    })

    port.end()
  })

  it('should leave no data listener behind on a reader it has closed', (done) => {
    const reader = build()
    port.open()
    expect(port.listenerCount('data')).toBeGreaterThan(0)

    reader.close(() => {
      // Both the pipe's own handler and our debug listener.
      expect(port.listenerCount('data')).toBe(0)
      done()
    })
  })

  it('should settle a mid-open close when the open fails instead', (done) => {
    const reader = build()

    reader.close((err) => {
      expect(err).toBeNull()
      expect(reader.state).toBe(VEDirect.CLOSED)
      done()
    })

    port.emit('error', new Error('ENOENT'))
  })

  it('should emit parsed frames as data', (done) => {
    const reader = build()
    port.open()

    reader.on('data', (frame) => {
      expect(frame.PID).toBeDefined()
      done()
    })

    port.write(VALID_FRAME)
  })

  it('should emit close with disconnected when the device is unplugged', (done) => {
    const reader = build()
    port.open()

    reader.on('close', (info) => {
      expect(info).toEqual({ disconnected: true })
      done()
    })

    port.disconnect()
  })

  it('should emit close when the readable side ends without any error', (done) => {
    const reader = build()
    port.open()

    reader.on('close', (info) => {
      expect(info).toEqual({ disconnected: true })
      done()
    })

    port.end()
  })

  it('should emit close only once', () => {
    const reader = build()
    port.open()
    const onClose = jest.fn()
    reader.on('close', onClose)

    port.disconnect()
    port.emit('close')
    port.emit('end')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should re-emit serial port errors', () => {
    const reader = build()
    const onError = jest.fn()
    reader.on('error', onError)
    const err = new Error('boom')

    port.emit('error', err)

    expect(onError).toHaveBeenCalledWith(err)
  })

  it('should not emit close when the owner closes it', (done) => {
    const reader = build()
    port.open()
    const onClose = jest.fn()
    reader.on('close', onClose)

    reader.close(() => {
      expect(onClose).not.toHaveBeenCalled()
      expect(port.isOpen).toBe(false)
      done()
    })
  })

  it('should stop emitting data once closed', (done) => {
    const reader = build()
    port.open()
    const onData = jest.fn()
    reader.on('data', onData)

    reader.close(() => {
      port.write(VALID_FRAME)
      setImmediate(() => {
        expect(onData).not.toHaveBeenCalled()
        done()
      })
    })
  })

  it('should call back when closing a port that never opened', (done) => {
    const reader = build()
    reader.on('error', () => {})
    // Report the failed open the way serialport does, so we are not "opening".
    port.emit('error', new Error('ENOENT'))

    reader.close(done)
  })

  it('should wait for a pending open before closing', (done) => {
    const reader = build()
    expect(reader.state).toBe(VEDirect.OPENING)

    reader.close(() => {
      expect(port.isOpen).toBe(false)
      done()
    })

    port.open()
  })

  it('should be safe to close more than once', (done) => {
    const reader = build()
    port.open()

    reader.close(() => {
      reader.close(done)
    })
  })

  it('should call back every waiter when several closes overlap', (done) => {
    const reader = build()
    const settled = []

    reader.close(() => settled.push('first'))
    reader.close(() => settled.push('second'))
    reader.close(() => {
      expect(settled).toEqual(['first', 'second'])
      done()
    })

    port.open()
  })

  it('should report a failed port close to the caller', (done) => {
    const reader = build()
    port.open()
    port.close = (callback) => process.nextTick(() => callback(new Error('EIO')))

    reader.close((err) => {
      expect(err.message).toBe('EIO')
      done()
    })
  })

  it('should land on a terminal state once a mid-open close settles', (done) => {
    const reader = build()

    reader.close(() => {
      expect(reader.state).toBe(VEDirect.CLOSED)
      done()
    })

    port.open()
  })

  it('should not settle the caller when the port errors during its close', (done) => {
    const reader = build()
    let release
    port.close = (callback) => { release = () => callback(null) }

    reader.close(() => {
      expect(port.isOpen).toBe(false)
      done()
    })

    port.open()
    // A stray error while the descriptor is still being released must not
    // report the close as finished.
    port.emit('error', new Error('late'))
    expect(release).toBeDefined()

    port.isOpen = false
    release()
  })

  it('should treat a failed open as already closed', (done) => {
    const reader = build()
    reader.on('error', () => {})

    port.emit('error', new Error('ENOENT'))

    expect(reader.state).toBe(VEDirect.CLOSED)
    reader.close(done)
  })

  it('should drop a frame that straddles the close', (done) => {
    const reader = build()
    port.open()
    const onData = jest.fn()
    reader.on('data', onData)

    // Half a frame is on the wire when the owner closes; the rest arrives
    // afterwards and must not reach an owner that has moved on.
    const split = Math.floor(VALID_FRAME.length / 2)
    port.write(VALID_FRAME.subarray(0, split))

    reader.close(() => {
      port.write(VALID_FRAME.subarray(split))
      setImmediate(() => {
        expect(onData).not.toHaveBeenCalled()
        done()
      })
    })
  })
})
