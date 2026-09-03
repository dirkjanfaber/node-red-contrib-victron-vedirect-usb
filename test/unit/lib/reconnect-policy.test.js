const {
  nextDelay,
  nextWarnGap,
  BASE_DELAY_MS,
  MAX_DELAY_MS,
  BASE_WARN_GAP_MS,
  MAX_WARN_GAP_MS
} = require('../../../src/lib/reconnect-policy')

// Neutral jitter: base + base * ratio * (0.5 * 2 - 1) === base
const noJitter = () => 0.5

describe('reconnect-policy', () => {
  describe('nextDelay', () => {
    it('should start at the base delay', () => {
      expect(nextDelay(0, noJitter)).toBe(BASE_DELAY_MS)
    })

    it('should double on each attempt', () => {
      expect(nextDelay(1, noJitter)).toBe(2000)
      expect(nextDelay(2, noJitter)).toBe(4000)
      expect(nextDelay(3, noJitter)).toBe(8000)
      expect(nextDelay(4, noJitter)).toBe(16000)
    })

    it('should cap at the maximum delay', () => {
      expect(nextDelay(5, noJitter)).toBe(MAX_DELAY_MS)
      expect(nextDelay(50, noJitter)).toBe(MAX_DELAY_MS)
      expect(nextDelay(1000, noJitter)).toBe(MAX_DELAY_MS)
    })

    it('should apply jitter within 20% of the base delay', () => {
      expect(nextDelay(0, () => 0)).toBe(800)
      expect(nextDelay(0, () => 0.999999)).toBe(1200)
      expect(nextDelay(5, () => 0)).toBe(24000)
    })

    it('should never exceed the maximum, jitter included', () => {
      expect(nextDelay(5, () => 0.999999)).toBe(MAX_DELAY_MS)
      expect(nextDelay(50, () => 0.999999)).toBe(MAX_DELAY_MS)
    })

    it('should stay within bounds for real randomness', () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        for (let i = 0; i < 50; i++) {
          const delay = nextDelay(attempt)
          expect(delay).toBeGreaterThanOrEqual(BASE_DELAY_MS * 0.8)
          expect(delay).toBeLessThanOrEqual(MAX_DELAY_MS)
        }
      }
    })

    it('should treat invalid attempt counts as the first attempt', () => {
      expect(nextDelay(-5, noJitter)).toBe(BASE_DELAY_MS)
      expect(nextDelay(undefined, noJitter)).toBe(BASE_DELAY_MS)
      expect(nextDelay(NaN, noJitter)).toBe(BASE_DELAY_MS)
    })

    it('should never return a delay that would busy-loop', () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        expect(nextDelay(attempt)).toBeGreaterThan(0)
      }
    })
  })

  describe('nextWarnGap', () => {
    it('should start at the base gap', () => {
      expect(nextWarnGap(0)).toBe(BASE_WARN_GAP_MS)
    })

    it('should double on each warning', () => {
      expect(nextWarnGap(1)).toBe(120000)
      expect(nextWarnGap(2)).toBe(240000)
    })

    it('should cap at the maximum gap', () => {
      expect(nextWarnGap(6)).toBe(MAX_WARN_GAP_MS)
      expect(nextWarnGap(100)).toBe(MAX_WARN_GAP_MS)
    })

    it('should treat invalid counts as the first warning', () => {
      expect(nextWarnGap(-1)).toBe(BASE_WARN_GAP_MS)
      expect(nextWarnGap(undefined)).toBe(BASE_WARN_GAP_MS)
      expect(nextWarnGap(NaN)).toBe(BASE_WARN_GAP_MS)
    })

    it('should follow a doubling sequence up to the cap', () => {
      const gaps = [0, 1, 2, 3, 4, 5, 6, 7].map((count) => nextWarnGap(count))

      expect(gaps).toEqual([60000, 120000, 240000, 480000, 960000, 1920000, 3600000, 3600000])
    })

    it('should keep a day-long outage to a readable number of lines', () => {
      let elapsed = 0
      let warnings = 0

      while (elapsed < 24 * 60 * 60 * 1000) {
        elapsed += nextWarnGap(warnings)
        warnings++
      }

      // Six lines in the first hour, hourly after that.
      expect(warnings).toBe(29)
    })
  })
})
