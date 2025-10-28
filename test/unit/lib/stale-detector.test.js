const { parseTimeout, isStale, getStatusDisplay } = require('../../../src/lib/stale-detector')

describe('stale-detector', () => {
  describe('parseTimeout', () => {
    test('should return null for undefined', () => {
      expect(parseTimeout(undefined)).toBeNull()
    })

    test('should return null for null', () => {
      expect(parseTimeout(null)).toBeNull()
    })

    test('should return null for empty string', () => {
      expect(parseTimeout('')).toBeNull()
    })

    test('should return null for zero', () => {
      expect(parseTimeout(0)).toBeNull()
    })

    test('should return null for negative values', () => {
      expect(parseTimeout(-5)).toBeNull()
    })

    test('should return null for NaN', () => {
      expect(parseTimeout('invalid')).toBeNull()
    })

    test('should convert seconds to milliseconds for valid positive number', () => {
      expect(parseTimeout(10)).toBe(10000)
    })

    test('should handle string numbers', () => {
      expect(parseTimeout('5')).toBe(5000)
    })

    test('should handle decimal values', () => {
      expect(parseTimeout(2.5)).toBe(2500)
    })

    test('should handle large values', () => {
      expect(parseTimeout(3600)).toBe(3600000) // 1 hour
    })
  })

  describe('isStale', () => {
    const NOW = 1000000
    const TEN_SECONDS = 10000

    test('should return false when timeout is disabled (null)', () => {
      expect(isStale(NOW - 20000, null, NOW)).toBe(false)
    })

    test('should return false when timeout is disabled (0)', () => {
      expect(isStale(NOW - 20000, 0, NOW)).toBe(false)
    })

    test('should return true when no data received yet', () => {
      expect(isStale(null, TEN_SECONDS, NOW)).toBe(true)
    })

    test('should return false when data is fresh (within timeout)', () => {
      const lastDataTime = NOW - 5000 // 5 seconds ago
      expect(isStale(lastDataTime, TEN_SECONDS, NOW)).toBe(false)
    })

    test('should return false when data is exactly at timeout boundary', () => {
      const lastDataTime = NOW - TEN_SECONDS
      expect(isStale(lastDataTime, TEN_SECONDS, NOW)).toBe(false)
    })

    test('should return true when data exceeds timeout', () => {
      const lastDataTime = NOW - 15000 // 15 seconds ago
      expect(isStale(lastDataTime, TEN_SECONDS, NOW)).toBe(true)
    })

    test('should return true when data is just past timeout', () => {
      const lastDataTime = NOW - TEN_SECONDS - 1
      expect(isStale(lastDataTime, TEN_SECONDS, NOW)).toBe(true)
    })

    test('should handle very recent data', () => {
      const lastDataTime = NOW - 100 // 100ms ago
      expect(isStale(lastDataTime, TEN_SECONDS, NOW)).toBe(false)
    })

    test('should handle very old data', () => {
      const lastDataTime = NOW - 1000000 // 1000 seconds ago
      expect(isStale(lastDataTime, TEN_SECONDS, NOW)).toBe(true)
    })

    test('should use Date.now() when currentTime not provided', () => {
      const lastDataTime = Date.now() - 5000
      expect(isStale(lastDataTime, TEN_SECONDS)).toBe(false)
    })
  })

  describe('getStatusDisplay', () => {
    test('should return stale status when data is stale', () => {
      expect(getStatusDisplay(true, 'SmartShunt 500A/50mV')).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'stale data'
      })
    })

    test('should return stale status when data is stale and no product', () => {
      expect(getStatusDisplay(true, null)).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'stale data'
      })
    })

    test('should return product name when data is fresh and product known', () => {
      expect(getStatusDisplay(false, 'SmartShunt 500A/50mV')).toEqual({
        fill: 'green',
        shape: 'dot',
        text: 'SmartShunt 500A/50mV'
      })
    })

    test('should return connected status when data is fresh but no product', () => {
      expect(getStatusDisplay(false, null)).toEqual({
        fill: 'green',
        shape: 'dot',
        text: 'connected'
      })
    })

    test('should return connected status when data is fresh and product is empty string', () => {
      expect(getStatusDisplay(false, '')).toEqual({
        fill: 'green',
        shape: 'dot',
        text: 'connected'
      })
    })

    test('should handle various product names', () => {
      const products = [
        'BMV-700',
        'SmartSolar MPPT 250|100',
        'Phoenix Inverter 12V 250VA 230V'
      ]

      products.forEach(product => {
        expect(getStatusDisplay(false, product)).toEqual({
          fill: 'green',
          shape: 'dot',
          text: product
        })
      })
    })

    test('should prioritize stale status over product name', () => {
      // Even with a product name, stale data should show stale status
      expect(getStatusDisplay(true, 'BMV-700')).toEqual({
        fill: 'yellow',
        shape: 'ring',
        text: 'stale data'
      })
    })
  })
})
