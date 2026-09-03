const { SerialPort } = require('serialport')
const { DelimiterParser } = require('@serialport/parser-delimiter')
const VEDirectParser = require('./parser')
const { EventEmitter } = require('events')
const { Writable } = require('stream')
const debug = require('debug')

const debugSerial = debug('vedirect:serial')
const debugDelimiter = debug('vedirect:delimiter')
const debugParser = debug('vedirect:parser')
const debugOutput = debug('vedirect:output')

// One lifecycle, one field. Four booleans encoded the same thing and allowed
// combinations that cannot happen.
const OPENING = 'opening'
const OPEN = 'open'
// The link is gone and the owner has been told, but the descriptor may still be
// held: a zero-byte read ends the stream without closing the port. Only CLOSED
// means the fd is released.
const LOST = 'lost'
const CLOSING = 'closing'
const CLOSED = 'closed'

/**
 * One VE.Direct connection: an open serial port plus the pipe chain that turns
 * its bytes into frames. The pipe chain cannot outlive the port (ending the
 * readable side ends every stream downstream of it), so a connection is
 * single-use: on 'close' the owner must throw it away and build a new one.
 *
 * @emits open  once the port is open
 * @emits data  for every complete, checksum-valid frame
 * @emits error on a serial port error
 * @emits close once the port is gone, with `{ disconnected }`
 *
 * `state` is readable but not writable by owners: OPENING, OPEN, LOST (link
 * gone, descriptor possibly still held), CLOSING, CLOSED (descriptor released).
 */
class VEDirect extends EventEmitter {
  constructor (path) {
    super()

    debugSerial('Creating serial port on %s', path)

    this.state = OPENING
    this.pendingClose = []

    this.serial = new SerialPort({
      path,
      baudRate: 19200,
      dataBits: 8,
      parity: 'none'
    })

    this.serial.on('open', () => {
      debugSerial('Serial port opened successfully')
      if (this.state === OPENING) {
        this.state = OPEN
      }
      this.emit('open')
    })

    this.serial.on('error', (err) => {
      debugSerial('Serial port error: %o', err)
      // An error before the port ever opened means there is nothing to close;
      // leaving the state at OPENING would make close() wait for an 'open'
      // that can no longer arrive.
      if (this.state === OPENING) {
        this.state = CLOSED
      }
      this.emit('error', err)
    })

    // A disconnect (USB unplug, driver reset) surfaces here and *not* on
    // 'error': serialport turns it into close(undefined, DisconnectedError).
    this.serial.on('close', (err) => {
      debugSerial('Serial port closed: %o', err)
      this._closed({ disconnected: Boolean(err && err.disconnected) })
    })

    // A zero-byte read ends the readable side without any close or error, so
    // the pipe chain goes quiet while the port still looks open.
    this.serial.on('end', () => {
      debugSerial('Serial port stream ended')
      this._closed({ disconnected: true })
    })

    // Kept by reference: removeAllListeners('data') would also take pipe()'s
    // own handler, severing the chain as a side effect rather than on purpose.
    this.onSerialData = (data) => {
      debugSerial('Received %d bytes: %s', data.length, data.toString('hex').substring(0, 40))
    }
    this.serial.on('data', this.onSerialData)

    this.rl = new DelimiterParser({
      delimiter: Buffer.from([0x0d, 0x0a], 'hex'),
      includeDelimiter: false
    })

    this.rl.on('data', (line) => {
      debugDelimiter('Parsed line: %s', line.toString())
    })

    this.ve = new VEDirectParser()

    let frameCount = 0

    // Create a Writable stream to consume the parser output
    // This is what makes the Transform stream actually emit data
    this.output = new Writable({
      objectMode: true,
      write: (data, encoding, callback) => {
        frameCount++
        debugParser('Parser emitted frame #%d with fields: %s', frameCount, Object.keys(data).join(', '))

        if (data.PID) {
          debugParser('  PID: %s (%s)', data.PID.value, data.PID.product || 'unknown product')
        }

        debugOutput('Emitting data event for frame #%d', frameCount)
        this.emit('data', data)
        callback()
      }
    })

    debugSerial('Setting up pipe chain: serial -> delimiter -> parser -> output')

    // Complete the pipe chain: serial -> delimiter -> parser -> output
    this.serial.pipe(this.rl).pipe(this.ve).pipe(this.output)

    debugSerial('Pipe chain established')
  }

  _closed (info) {
    if (this.state === LOST || this.state === CLOSING || this.state === CLOSED) {
      return
    }

    this.state = LOST
    this.emit('close', info)
  }

  /**
   * Tear the connection down. Safe to call more than once, and on a port that
   * is already gone. Never emits 'close' - the caller is the one closing.
   * @param {function=} callback - Called with the close error, or null, once the port is closed
   */
  close (callback) {
    const done = callback || (() => {})

    // A reader can reach CLOSED without us: an open that failed, for one. The
    // teardown is idempotent, and CLOSED has to mean detached as well as
    // released, or a dead reader keeps its owner's listeners.
    if (this.state === CLOSED) {
      this.detach()
      return process.nextTick(() => done(null))
    }

    // Queue late callers behind an in-flight close. Re-running the teardown
    // would strip the listeners the first close is waiting on, and its
    // callback - which is Node-RED's `done` - would never fire.
    if (this.state === CLOSING) {
      this.pendingClose.push(done)
      return
    }

    // Ask the driver too: our own state can be LOST while its open is still
    // in flight, and an unowned open would hold the descriptor.
    const wasOpening = this.state === OPENING || this.serial.opening

    this.state = CLOSING
    this.pendingClose = [done]

    this.detach()

    const finish = (err) => {
      if (this.state === CLOSED) {
        return
      }

      this.state = CLOSED

      // Not a repeat of detach(): the branches below arm listeners after it
      // has run, and those are what this disarms.
      this.detachOpenListeners()
      this.serial.removeAllListeners('close')

      const callbacks = this.pendingClose
      this.pendingClose = []

      // Always async, so a caller's callback never runs before close() returns.
      process.nextTick(() => callbacks.forEach((cb) => cb(err || null)))
    }

    const closePort = () => {
      // Disarm the mid-open pair: a stray error during the close itself must
      // not settle the caller while the descriptor is still being released.
      this.detachOpenListeners()
      this.serial.close(finish)
    }

    if (this.serial.isOpen) {
      return closePort()
    }

    // Closing mid-open would leave the pending open to succeed unowned, so
    // wait for it to land (or fail) first. An open that fails leaves nothing
    // to close, and the owner is closing anyway, so it is not a close error.
    if (wasOpening) {
      debugSerial('Close requested while still opening')
      this.serial.once('open', closePort)
      this.serial.once('error', () => finish(null))
      return
    }

    // The driver flips `closing` before it awaits the fd release, so a
    // disconnect caught mid-teardown reads as shut but is not. Wait for it to
    // land rather than telling our caller the fd is free - on either outcome:
    // a close it started itself reports failure as 'error' and never emits
    // 'close' at all, and waiting only for the latter would hang forever.
    if (this.serial.closing) {
      debugSerial('Close requested while the driver is already closing')
      this.serial.once('close', () => finish(null))
      this.serial.once('error', (err) => finish(err))
      return
    }

    debugSerial('Close requested but port is not open')
    finish(null)
  }

  // Stop the byte flow and drop our listeners, so a late frame - or the close
  // we are about to cause - can't reach an owner that has already moved on.
  detach () {
    this.serial.unpipe(this.rl)
    this.rl.unpipe(this.ve)
    this.ve.unpipe(this.output)

    this.removeAllListeners()
    this.serial.removeListener('data', this.onSerialData)
    this.serial.removeAllListeners('close')
    this.serial.removeAllListeners('end')
    this.detachOpenListeners()
  }

  // Note the coupling: 'open' also carries the driver's own primed-read resume
  // (@serialport/stream once('open') in _read), so this must only ever run on a
  // reader that is being discarded.
  detachOpenListeners () {
    this.serial.removeAllListeners('open')
    this.serial.removeAllListeners('error')
    this.serial.on('error', (err) => debugSerial('Error after close: %o', err))
  }
}

VEDirect.OPENING = OPENING
VEDirect.OPEN = OPEN
VEDirect.LOST = LOST
VEDirect.CLOSING = CLOSING
VEDirect.CLOSED = CLOSED

module.exports = VEDirect
