const { createWarnThrottle } = require('../../../src/lib/warn-throttle')
const { BASE_WARN_GAP_MS } = require('../../../src/lib/reconnect-policy')

describe('warn-throttle', () => {
  let clock
  let throttle
  let said

  beforeEach(() => {
    clock = 0
    throttle = createWarnThrottle(() => clock)
    said = []
  })

  const say = (channel, message) =>
    throttle.say(channel, (built) => said.push(built), () => message)

  it('should say the first message on a channel', () => {
    expect(say('connection', 'first')).toBe(true)
    expect(said).toEqual(['first'])
  })

  it('should stay quiet inside the gap, whatever the message says', () => {
    say('connection', 'lost the connection')
    clock += 1000

    // The same fault alternates wording between attempts; both are the same
    // ongoing problem.
    expect(say('connection', 'cannot open')).toBe(false)
    expect(said).toEqual(['lost the connection'])
  })

  it('should speak again once the gap has passed', () => {
    say('connection', 'first')
    clock += BASE_WARN_GAP_MS

    expect(say('connection', 'second')).toBe(true)
    expect(said).toEqual(['first', 'second'])
  })

  it('should widen the gap after each message', () => {
    say('connection', 'one')
    clock += BASE_WARN_GAP_MS
    say('connection', 'two')

    clock += BASE_WARN_GAP_MS
    expect(say('connection', 'too soon')).toBe(false)

    clock += BASE_WARN_GAP_MS
    expect(say('connection', 'three')).toBe(true)
  })

  it('should keep channels independent', () => {
    say('connection', 'connection problem')

    expect(say('close', 'close problem')).toBe(true)
    expect(said).toEqual(['connection problem', 'close problem'])
  })

  it('should speak at once after a reset', () => {
    say('connection', 'one')
    throttle.reset('connection')

    expect(say('connection', 'two')).toBe(true)
  })

  it('should reset only the named channel', () => {
    say('connection', 'connection problem')
    say('close', 'close problem')
    throttle.reset('close')

    expect(say('connection', 'still throttled')).toBe(false)
    expect(say('close', 'reported')).toBe(true)
  })

  it('should not build a message it will not say', () => {
    const build = jest.fn(() => 'message')

    throttle.say('connection', () => {}, build)
    throttle.say('connection', () => {}, build)

    expect(build).toHaveBeenCalledTimes(1)
  })
})
