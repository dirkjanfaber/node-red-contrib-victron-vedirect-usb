const {
  getStatusDisplay,
  CONNECTING,
  CONNECTED,
  RECONNECTING,
  ERROR
} = require('../../../src/lib/connection-status')

const connected = (extra) => ({ state: CONNECTED, hasData: true, ...extra })

describe('connection-status', () => {
  describe('getStatusDisplay', () => {
    it('should show the error message over everything else', () => {
      expect(getStatusDisplay({
        state: ERROR,
        error: 'Permission denied, cannot open /dev/ttyUSB0',
        hasData: true,
        stale: true,
        productName: 'BMV-700'
      })).toEqual({
        fill: 'red',
        shape: 'dot',
        text: 'retrying: Permission denied, cannot open /dev/ttyUSB0'
      })
    })

    it('should fall back to a generic error text', () => {
      expect(getStatusDisplay({ state: ERROR })).toEqual({
        fill: 'red',
        shape: 'dot',
        text: 'retrying: error'
      })
    })

    it('should show connecting over stale data', () => {
      expect(getStatusDisplay({ state: CONNECTING, stale: true, productName: 'BMV-700' })).toEqual({
        fill: 'blue',
        shape: 'ring',
        text: 'connecting'
      })
    })

    it('should name the reason it is reconnecting', () => {
      expect(getStatusDisplay({ state: RECONNECTING, reason: 'close' })).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'reconnecting (disconnected)'
      })
      expect(getStatusDisplay({ state: RECONNECTING, reason: 'stale data' })).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'reconnecting (no data)'
      })
    })

    it('should distinguish an unplugged cable from a mute device', () => {
      const unplugged = getStatusDisplay({ state: RECONNECTING, reason: 'close' })
      const mute = getStatusDisplay({ state: RECONNECTING, reason: 'stale data' })

      expect(unplugged.text).not.toEqual(mute.text)
    })

    it('should fall back to a bare reconnecting text for an unknown reason', () => {
      expect(getStatusDisplay({ state: RECONNECTING, reason: 'something new' })).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'reconnecting'
      })
      expect(getStatusDisplay({ state: RECONNECTING })).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'reconnecting'
      })
    })

    it('should wait for data before reporting anything about staleness', () => {
      expect(getStatusDisplay({ state: CONNECTED, hasData: false, stale: true })).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'waiting for data'
      })
    })

    it('should show stale data once a frame has been seen', () => {
      expect(getStatusDisplay(connected({ stale: true, productName: 'BMV-700' }))).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'stale data'
      })
    })

    it('should show the product name when fresh', () => {
      expect(getStatusDisplay(connected({ productName: 'SmartShunt 500A/50mV' }))).toEqual({
        fill: 'green',
        shape: 'dot',
        text: 'SmartShunt 500A/50mV'
      })
    })

    it('should fall back to "connected" before the product is identified', () => {
      expect(getStatusDisplay(connected())).toEqual({
        fill: 'green',
        shape: 'dot',
        text: 'connected'
      })
      expect(getStatusDisplay(connected({ productName: '' }))).toEqual({
        fill: 'green',
        shape: 'dot',
        text: 'connected'
      })
    })

    it('should not report a down connection as connected', () => {
      const downStates = [CONNECTING, RECONNECTING, ERROR]

      downStates.forEach((state) => {
        expect(getStatusDisplay({ state, hasData: true, productName: 'BMV-700' }).fill)
          .not.toBe('green')
      })
    })

    it('should not claim health for a missing or unknown state', () => {
      const unknown = { fill: 'grey', shape: 'ring', text: 'unknown' }

      expect(getStatusDisplay()).toEqual(unknown)
      expect(getStatusDisplay(null)).toEqual(unknown)
      expect(getStatusDisplay({ state: 'nonsense', hasData: true, productName: 'BMV-700' })).toEqual(unknown)
    })
  })
})
