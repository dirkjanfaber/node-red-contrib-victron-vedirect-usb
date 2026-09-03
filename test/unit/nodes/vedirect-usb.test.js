const { EventEmitter } = require('events')

// A stand-in for the VEDirect connection: records how many were built, and
// lets a test replay open/data/error/close on whichever one is current.
class MockVEDirect extends EventEmitter {
  constructor (path) {
    super()

    if (MockVEDirect.failNextConstruction) {
      MockVEDirect.failNextConstruction = false
      throw new Error('Permission denied, cannot open ' + path)
    }

    this.path = path
    this.closeCalls = 0
    this.closeCallback = null
    MockVEDirect.instances.push(this)
  }

  close (callback) {
    this.closeCalls++
    this.closeCallback = callback
    if (!this.holdClose) {
      process.nextTick(() => callback && callback(this.closeError || null))
    }
  }
}

MockVEDirect.instances = []
MockVEDirect.failNextConstruction = false

const mockList = jest.fn()

jest.mock('serialport', () => ({ SerialPort: { list: mockList } }))
jest.mock('../../../src/services/vedirect', () => MockVEDirect)

const registerNode = require('../../../src/nodes/vedirect-usb')
const {
  MAX_DELAY_MS,
  LIVENESS_TIMEOUT_MS,
  BASE_WARN_GAP_MS,
  MAX_WARN_GAP_MS,
  STEADY_MS
} = require('../../../src/lib/reconnect-policy')

// Backoff is jittered, so no test may assume an exact delay. Stepping past the
// hard cap always lands after whatever delay was picked.
const PAST_BACKOFF = MAX_DELAY_MS + 1

const PID_FRAME = { PID: { value: '0xA389', product: 'SmartShunt 500A/50mV' } }

// Mirrors CLOSE_TIMEOUT_MS in the node; it is local policy, not shared config.
const CLOSE_TIMEOUT_MS = 5000

let VEDirectUSB

const RED = {
  nodes: {
    createNode: () => {},
    registerType: (_name, ctor) => { VEDirectUSB = ctor }
  },
  httpAdmin: { get: () => {} },
  log: { error: () => {} }
}

registerNode(RED)

// Let the SerialPort.list() promise chain inside connect() run to completion.
const settle = () => new Promise((resolve) => setImmediate(resolve))

function buildNode (config = {}) {
  const node = new EventEmitter()
  node.status = jest.fn()
  node.warn = jest.fn()
  node.send = jest.fn()
  node.log = jest.fn()

  VEDirectUSB.call(node, { port: '/dev/ttyUSB0', timeout: 10, ...config })

  return node
}

const current = () => MockVEDirect.instances[MockVEDirect.instances.length - 1]
const lastStatus = (node) => node.status.mock.calls[node.status.mock.calls.length - 1][0]

// Bring a node to the point where a connection is open and a frame has landed.
async function connectedNode (config) {
  const node = buildNode(config)
  await settle()
  current().emit('open')
  current().emit('data', PID_FRAME)
  return node
}

async function closeNode (node) {
  await new Promise((resolve) => node.emit('close', resolve))
}

describe('VEDirectUSB node', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    MockVEDirect.instances = []
    MockVEDirect.failNextConstruction = false
    mockList.mockReset()
    mockList.mockResolvedValue([])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should open the configured port and report connecting', async () => {
    const node = buildNode()

    expect(lastStatus(node)).toEqual({ fill: 'blue', shape: 'ring', text: 'connecting' })

    await settle()

    expect(MockVEDirect.instances).toHaveLength(1)
    expect(current().path).toBe('/dev/ttyUSB0')

    await closeNode(node)
  })

  it('should show the product name once a frame arrives', async () => {
    const node = await connectedNode()

    expect(lastStatus(node)).toEqual({
      fill: 'green',
      shape: 'dot',
      text: 'SmartShunt 500A/50mV'
    })

    await closeNode(node)
  })

  it('should wait for data rather than call a fresh connection stale', async () => {
    const node = buildNode()
    await settle()
    current().emit('open')

    jest.advanceTimersByTime(1000)

    expect(lastStatus(node)).toEqual({ fill: 'yellow', shape: 'ring', text: 'waiting for data' })

    await closeNode(node)
  })

  it('should build a new connection after the port closes', async () => {
    const node = await connectedNode()

    current().emit('close', { disconnected: true })

    expect(lastStatus(node)).toEqual({
      fill: 'yellow',
      shape: 'ring',
      text: 'reconnecting (disconnected)'
    })
    expect(MockVEDirect.instances).toHaveLength(1)

    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    expect(MockVEDirect.instances).toHaveLength(2)

    await closeNode(node)
  })

  // Regression: the liveness check anchored on lastDataTime alone, so a
  // timestamp from before the disconnect made every fresh connection look
  // stale one second after opening, and the node reconnect-looped forever.
  it('should not tear down a fresh connection because of pre-disconnect data', async () => {
    const node = await connectedNode({ timeout: 10 })

    // Go silent so the watchdog reconnects; lastDataTime is now well past the
    // timeout by the time the replacement connection opens.
    jest.advanceTimersByTime(LIVENESS_TIMEOUT_MS + 1000)
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    expect(MockVEDirect.instances).toHaveLength(2)
    current().emit('open')

    jest.advanceTimersByTime(5000) // inside the 10s timeout, no frame yet

    expect(MockVEDirect.instances).toHaveLength(2)

    // Still "stale data" rather than "waiting for data": the pre-disconnect
    // frame is kept so a partial first frame doesn't lose the other fields.
    expect(lastStatus(node)).toEqual({ fill: 'yellow', shape: 'ring', text: 'stale data' })

    await closeNode(node)
  })

  it('should reconnect when an open port goes silent', async () => {
    const node = await connectedNode({ timeout: 10 })

    jest.advanceTimersByTime(LIVENESS_TIMEOUT_MS + 1000)

    expect(lastStatus(node)).toEqual({
      fill: 'yellow',
      shape: 'ring',
      text: 'reconnecting (no data)'
    })

    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    expect(MockVEDirect.instances).toHaveLength(2)

    await closeNode(node)
  })

  it('should supervise liveness even when stale detection is disabled', async () => {
    const node = await connectedNode({ timeout: '' })

    jest.advanceTimersByTime(LIVENESS_TIMEOUT_MS - 1000)
    expect(MockVEDirect.instances).toHaveLength(1)

    jest.advanceTimersByTime(2000)
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    expect(MockVEDirect.instances).toHaveLength(2)

    await closeNode(node)
  })

  it('should hold the error message on screen while retrying', async () => {
    const node = buildNode()
    await settle()
    current().emit('error', new Error('Permission denied'))

    expect(lastStatus(node)).toEqual({
      fill: 'red',
      shape: 'dot',
      text: 'retrying: Permission denied'
    })

    await closeNode(node)
  })

  it('should warn once at the start of an outage, not once per attempt', async () => {
    const node = buildNode()
    await settle()

    current().emit('error', new Error('Permission denied'))

    expect(node.warn).toHaveBeenCalledTimes(1)
    expect(node.warn.mock.calls[0][0])
      .toBe('Permission denied on /dev/ttyUSB0 (attempt 1, failing for 0s, retrying)')

    // Retries inside the first quiet period add nothing. Ten seconds a step
    // outruns the early backoff without reaching BASE_WARN_GAP_MS.
    for (let i = 0; i < 4; i++) {
      jest.advanceTimersByTime(10000)
      await settle()
      current().emit('error', new Error('Permission denied'))
    }

    expect(node.warn).toHaveBeenCalledTimes(1)

    await closeNode(node)
  })

  // A dead cable alternates between "lost the connection" and the driver's
  // open failure, so dedup on the message text alone warned on every retry.
  it('should stay quiet when the failure alternates between two messages', async () => {
    const node = await connectedNode()

    for (let i = 0; i < 6; i++) {
      current().emit('close', { disconnected: true })
      jest.advanceTimersByTime(10000)
      await settle()
      current().emit('error', new Error('No such file or directory'))
      jest.advanceTimersByTime(10000)
      await settle()
    }

    // Twelve failures over two minutes: a couple of lines, not twelve.
    expect(node.warn.mock.calls.length).toBeLessThanOrEqual(3)

    await closeNode(node)
  })

  it('should speak up again once the quiet period has passed', async () => {
    const node = buildNode()
    await settle()

    current().emit('error', new Error('Permission denied'))
    expect(node.warn).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(BASE_WARN_GAP_MS + 1000)
    await settle()
    current().emit('error', new Error('Permission denied'))

    expect(node.warn).toHaveBeenCalledTimes(2)
    expect(node.warn.mock.calls[1][0]).toMatch(/failing for 6[0-9]s/)

    await closeNode(node)
  })

  it('should back the quiet period off towards the maximum', async () => {
    const node = buildNode()
    await settle()

    current().emit('error', new Error('Permission denied'))

    // Second warning needs one gap, the third needs twice that.
    jest.advanceTimersByTime(BASE_WARN_GAP_MS + 1000)
    current().emit('error', new Error('Permission denied'))
    expect(node.warn).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(BASE_WARN_GAP_MS + 1000)
    current().emit('error', new Error('Permission denied'))
    expect(node.warn).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(BASE_WARN_GAP_MS + 1000)
    current().emit('error', new Error('Permission denied'))
    expect(node.warn).toHaveBeenCalledTimes(3)

    await closeNode(node)
  })

  it('should reset the backoff and log recovery once data returns', async () => {
    const node = buildNode()
    await settle()

    current().emit('error', new Error('Permission denied'))
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    current().emit('open')
    current().emit('data', PID_FRAME)

    // Recovery goes to warn, not log: only warn and error reach the editor's
    // debug sidebar, where the operator is watching the failure it closes.
    expect(node.warn.mock.calls.some(([msg]) =>
      /Receiving data again on \/dev\/ttyUSB0 after 1 attempt\(s\) over \d+s/.test(msg))).toBe(true)

    // Backoff restarted, so the next retry lands well inside the cap.
    current().emit('close', {})
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()
    expect(MockVEDirect.instances).toHaveLength(3)

    await closeNode(node)
  })

  it('should re-resolve the port on every attempt', async () => {
    const node = buildNode({ port: '/dev/ttyUSB0', serialNumber: 'HQ2123ABCDE' })
    mockList.mockResolvedValue([{ path: '/dev/ttyUSB0', serialNumber: 'HQ2123ABCDE' }])
    await settle()

    // The cable comes back on a different device name after a replug.
    mockList.mockResolvedValue([{ path: '/dev/ttyUSB3', serialNumber: 'HQ2123ABCDE' }])
    current().emit('close', { disconnected: true })
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    expect(current().path).toBe('/dev/ttyUSB3')

    await closeNode(node)
  })

  it('should stop reconnecting once the node is closed', async () => {
    const node = await connectedNode()

    current().emit('close', { disconnected: true })
    await closeNode(node)

    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    expect(MockVEDirect.instances).toHaveLength(1)
  })

  it('should not open a port when the node closes mid-resolution', async () => {
    const node = buildNode()

    await closeNode(node)
    await settle()

    expect(MockVEDirect.instances).toHaveLength(0)
  })

  it('should wait for an in-flight reader close before reporting closed', async () => {
    const node = await connectedNode()
    const reader = current()
    reader.holdClose = true

    // Node close lands during the backoff, while the old reader is still going.
    reader.emit('close', { disconnected: true })
    expect(reader.closeCalls).toBe(1)

    let done = false
    const closing = new Promise((resolve) => {
      node.emit('close', () => { done = true; resolve() })
    })

    await settle()
    expect(done).toBe(false)

    reader.closeCallback(null)
    await closing

    expect(done).toBe(true)
  })

  it('should not schedule two reconnects for one failure', async () => {
    const node = await connectedNode()

    current().emit('error', new Error('boom'))
    current().emit('close', { disconnected: true })

    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    expect(MockVEDirect.instances).toHaveLength(2)

    await closeNode(node)
  })

  it('should send accumulated data on input and withhold it when stale', async () => {
    const node = await connectedNode({ timeout: 10 })

    node.emit('input', {})
    expect(node.send).toHaveBeenCalledTimes(1)
    expect(node.send.mock.calls[0][0].payload.PID.product).toBe('SmartShunt 500A/50mV')

    jest.advanceTimersByTime(11000)
    node.emit('input', {})

    expect(node.send).toHaveBeenCalledTimes(1)

    await closeNode(node)
  })

  it('should not let an input overwrite a live reconnecting status', async () => {
    const node = await connectedNode({ timeout: 10 })

    current().emit('close', { disconnected: true })
    node.emit('input', {})

    expect(lastStatus(node)).toEqual({
      fill: 'yellow',
      shape: 'ring',
      text: 'reconnecting (disconnected)'
    })

    await closeNode(node)
  })

  it('should retry when the connection cannot even be constructed', async () => {
    MockVEDirect.failNextConstruction = true
    const node = buildNode()
    await settle()

    expect(MockVEDirect.instances).toHaveLength(0)
    expect(lastStatus(node).fill).toBe('red')
    expect(lastStatus(node).text).toMatch(/^retrying: Permission denied/)
    expect(node.warn).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    expect(MockVEDirect.instances).toHaveLength(1)

    await closeNode(node)
  })

  it('should warn when a reader fails to close', async () => {
    const node = await connectedNode()
    current().closeError = new Error('EIO')

    current().emit('close', { disconnected: true })
    await settle()

    expect(node.warn.mock.calls.some(([msg]) => /Failed to close \/dev\/ttyUSB0: EIO/.test(msg))).toBe(true)

    await closeNode(node)
  })

  it('should warn about a lost connection, not just show a badge', async () => {
    const node = await connectedNode()

    current().emit('close', { disconnected: true })

    expect(node.warn).toHaveBeenCalledTimes(1)
    expect(node.warn.mock.calls[0][0]).toMatch(/Lost the serial connection on \/dev\/ttyUSB0/)

    await closeNode(node)
  })

  it('should warn about a silent device', async () => {
    const node = await connectedNode({ timeout: 10 })

    jest.advanceTimersByTime(LIVENESS_TIMEOUT_MS + 1000)

    expect(node.warn.mock.calls[0][0]).toMatch(/No data for 60s/)

    await closeNode(node)
  })

  it('should keep a readable trail through a day-long outage', async () => {
    const node = buildNode()
    await settle()

    current().emit('error', new Error('Permission denied'))

    for (let i = 0; i < 24 * 60; i++) {
      jest.advanceTimersByTime(60000)
      current().emit('error', new Error('Permission denied'))
    }

    // Doubling to a one hour ceiling gives 29 lines. The bounds are wide on
    // purpose: warning per attempt would give 1441, and doubling with no
    // ceiling would give about 11.
    expect(node.warn.mock.calls.length).toBeLessThan(40)
    expect(node.warn.mock.calls.length).toBeGreaterThan(20)

    await closeNode(node)
  })

  it('should not let a short output timeout tear down a healthy port', async () => {
    // A 1 second timeout is a display preference; it must not become a
    // link-is-dead threshold and kill the port between two frames.
    const node = await connectedNode({ timeout: 1 })

    jest.advanceTimersByTime(30000)

    expect(MockVEDirect.instances).toHaveLength(1)
    expect(lastStatus(node)).toEqual({ fill: 'yellow', shape: 'ring', text: 'stale data' })

    await closeNode(node)
  })

  it('should report a fresh outage at once after the link has held', async () => {
    const node = await connectedNode()

    // Drag the outage out until the quiet period has widened to its one hour
    // ceiling, far past the time the link will later be held for.
    current().emit('close', { disconnected: true })
    for (let i = 0; i < 7; i++) {
      jest.advanceTimersByTime(MAX_WARN_GAP_MS + 1000)
      await settle()
      current().emit('error', new Error('No such file or directory'))
    }

    const failureWarns = () => node.warn.mock.calls.filter(([msg]) => /retrying/.test(msg)).length
    const duringOutage = failureWarns()
    expect(duringOutage).toBe(8)

    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()
    current().emit('open')
    current().emit('data', PID_FRAME)

    // Hold the link long enough to count as recovered, but for far less than
    // the quiet period the outage had grown to.
    for (let i = 0; i < 70; i++) {
      jest.advanceTimersByTime(1000)
      current().emit('data', PID_FRAME)
    }

    current().emit('close', { disconnected: true })

    expect(failureWarns()).toBe(duringOutage + 1)

    await closeNode(node)
  })

  // A cable that flaps every few seconds delivers a frame per cycle. Treating
  // one frame as recovery cleared the throttle on every flap, which is the log
  // storm the throttle exists to prevent.
  it('should stay quiet through a cable that flaps every few seconds', async () => {
    const node = await connectedNode()

    for (let i = 0; i < 20; i++) {
      current().emit('close', { disconnected: true })
      jest.advanceTimersByTime(PAST_BACKOFF)
      await settle()
      current().emit('open')
      current().emit('data', PID_FRAME)
      jest.advanceTimersByTime(5000)
    }

    // Twenty flaps over about ten minutes. Both channels are throttled, so a
    // handful of lines rather than the forty an untrottled pair would give.
    expect(node.warn.mock.calls.length).toBeLessThanOrEqual(10)

    await closeNode(node)
  })

  it('should report a long outage in minutes rather than seconds', async () => {
    const node = buildNode()
    await settle()

    current().emit('error', new Error('Permission denied'))

    jest.advanceTimersByTime(10 * 60 * 1000)
    await settle()
    current().emit('error', new Error('Permission denied'))

    expect(node.warn.mock.calls[1][0]).toMatch(/failing for 10m/)

    await closeNode(node)
  })

  it('should name the port a failing close belonged to', async () => {
    const node = buildNode({ port: '/dev/ttyUSB0', serialNumber: 'HQ2123ABCDE' })
    mockList.mockResolvedValue([{ path: '/dev/ttyUSB0', serialNumber: 'HQ2123ABCDE' }])
    await settle()
    current().emit('open')

    const reader = current()
    reader.holdClose = true
    reader.emit('close', { disconnected: true })

    // The cable comes back on another name before the old close finishes.
    mockList.mockResolvedValue([{ path: '/dev/ttyUSB3', serialNumber: 'HQ2123ABCDE' }])
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()
    reader.closeCallback(new Error('EIO'))
    await settle()

    expect(node.warn.mock.calls.some(([msg]) => /Failed to close \/dev\/ttyUSB0: EIO/.test(msg))).toBe(true)

    await closeNode(node)
  })

  it('should report a later close failure rather than inherit the last one', async () => {
    const node = await connectedNode()

    // Fail a close, then close cleanly, then fail again. The clean teardown
    // ends the run, so the second failure is reported at once.
    current().closeError = new Error('EIO')
    current().emit('close', { disconnected: true })
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    current().emit('close', { disconnected: true })
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()

    current().closeError = new Error('EBUSY')
    current().emit('close', { disconnected: true })
    await settle()

    expect(node.warn.mock.calls.some(([msg]) => /Failed to close .*EBUSY/.test(msg))).toBe(true)

    await closeNode(node)
  })

  // Without resetting the recovery channel its gap keeps widening, so a later
  // recovery goes unannounced while the failure that preceded it is on screen.
  it('should announce every recovery, not just the early ones', async () => {
    const node = await connectedNode()
    const recoveries = () =>
      node.warn.mock.calls.filter(([msg]) => /Receiving data again/.test(msg)).length

    for (let round = 0; round < 3; round++) {
      current().emit('close', { disconnected: true })
      jest.advanceTimersByTime(PAST_BACKOFF)
      await settle()
      current().emit('open')

      // Hold the link long enough for the outage to count as over.
      for (let i = 0; i < 70; i++) {
        current().emit('data', PID_FRAME)
        jest.advanceTimersByTime(1000)
      }
    }

    expect(recoveries()).toBe(3)

    await closeNode(node)
  })

  // A device that sends one frame and then dies must not age into "recovered"
  // while silent, or a flap would clear the throttle on every cycle.
  it('should not count a single frame followed by silence as recovery', async () => {
    // A ten minute timeout keeps the liveness watchdog out of the way, so the
    // only thing that could speak again is a reset throttle.
    const node = await connectedNode({ timeout: 600 })
    const failureWarns = () => node.warn.mock.calls.filter(([msg]) => /retrying/.test(msg)).length

    // Widen the quiet period well past the steady window.
    current().emit('close', { disconnected: true })
    for (let i = 0; i < 7; i++) {
      jest.advanceTimersByTime(MAX_WARN_GAP_MS + 1000)
      await settle()
      current().emit('error', new Error('No such file or directory'))
    }
    const duringOutage = failureWarns()

    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()
    current().emit('open')
    current().emit('data', PID_FRAME)

    // One frame, then nothing, for longer than the steady window.
    jest.advanceTimersByTime(STEADY_MS + 5000)

    current().emit('close', { disconnected: true })

    expect(failureWarns()).toBe(duringOutage)

    await closeNode(node)
  })

  // The deadline exists to flag a stuck descriptor. Left armed after a clean
  // close it fires on every deploy, naming a node that is already gone.
  it('should leave no deadline armed after a clean close', async () => {
    const node = await connectedNode()

    await closeNode(node)

    expect(jest.getTimerCount()).toBe(0)

    jest.advanceTimersByTime(CLOSE_TIMEOUT_MS * 2)

    expect(node.warn.mock.calls.some(([msg]) => /Gave up waiting/.test(msg))).toBe(false)
  })

  it('should give up on a close that never finishes, naming only the stuck port', async () => {
    const node = buildNode({ port: '/dev/ttyUSB0', serialNumber: 'HQ2123ABCDE' })
    mockList.mockResolvedValue([{ path: '/dev/ttyUSB0', serialNumber: 'HQ2123ABCDE' }])
    await settle()

    // Close a couple of readers cleanly first: their entries must not linger
    // and get named alongside the one that is actually stuck.
    for (let i = 0; i < 2; i++) {
      current().emit('close', { disconnected: true })
      jest.advanceTimersByTime(PAST_BACKOFF)
      await settle()
    }

    mockList.mockResolvedValue([{ path: '/dev/ttyUSB3', serialNumber: 'HQ2123ABCDE' }])
    current().emit('close', { disconnected: true })
    jest.advanceTimersByTime(PAST_BACKOFF)
    await settle()
    expect(current().path).toBe('/dev/ttyUSB3')
    current().holdClose = true

    let done = false
    const closing = new Promise((resolve) => {
      node.emit('close', () => { done = true; resolve() })
    })

    await settle()
    expect(done).toBe(false)

    jest.advanceTimersByTime(CLOSE_TIMEOUT_MS + 1000)
    await closing

    expect(done).toBe(true)
    const gaveUp = node.warn.mock.calls.map(([msg]) => msg).find((msg) => /Gave up waiting/.test(msg))
    expect(gaveUp).toBe('Gave up waiting for /dev/ttyUSB3 to close')
  })

  it('should leave no retry armed when closed mid-backoff', async () => {
    const node = buildNode()
    await settle()

    current().emit('error', new Error('Permission denied'))
    await closeNode(node)

    expect(jest.getTimerCount()).toBe(0)
  })

  // The headline claim is "1s up to 30s". Feeding a constant to nextDelay
  // instead of the attempt count degrades that to a 1s hot retry loop against
  // a dead USB hub, which on a battery-powered van matters.
  it('should widen the gap between attempts', async () => {
    const node = buildNode()
    await settle()

    current().emit('error', new Error('Permission denied'))

    // First backoff is 800-1200ms, so this lands the second attempt.
    jest.advanceTimersByTime(1300)
    await settle()
    expect(MockVEDirect.instances).toHaveLength(2)

    current().emit('error', new Error('Permission denied'))

    // The second is 1600-2400ms, so the same step must not be enough.
    jest.advanceTimersByTime(1500)
    await settle()
    expect(MockVEDirect.instances).toHaveLength(2)

    jest.advanceTimersByTime(1000)
    await settle()
    expect(MockVEDirect.instances).toHaveLength(3)

    await closeNode(node)
  })

  it('should repaint the badge when it sends', async () => {
    const node = await connectedNode()
    node.status.mockClear()

    node.emit('input', {})

    expect(node.send).toHaveBeenCalledTimes(1)
    expect(node.status).toHaveBeenCalledWith({
      fill: 'green',
      shape: 'dot',
      text: 'SmartShunt 500A/50mV'
    })

    await closeNode(node)
  })

  // The driver reports a close on nextTick, which runs before the race's own
  // continuation, so the last reader can settle on the deadline itself. Warning
  // then named nobody at all: "Gave up waiting for  to close".
  it('should not claim it gave up when the close lands on the deadline', async () => {
    const node = await connectedNode()
    const reader = current()
    reader.holdClose = true

    let done = false
    const closing = new Promise((resolve) => {
      node.emit('close', () => { done = true; resolve() })
    })
    await settle()

    // Fire the deadline, then let the close land in the same turn.
    jest.advanceTimersByTime(CLOSE_TIMEOUT_MS)
    reader.closeCallback(null)

    await closing

    expect(done).toBe(true)
    expect(node.warn.mock.calls.some(([msg]) => /Gave up waiting/.test(msg))).toBe(false)
  })
})
