const { describeDuration } = require('../../../src/lib/duration')

describe('duration', () => {
  describe('describeDuration', () => {
    it('should report short spans in seconds', () => {
      expect(describeDuration(0)).toBe('0s')
      expect(describeDuration(1000)).toBe('1s')
      expect(describeDuration(119000)).toBe('119s')
    })

    it('should switch to minutes at two minutes', () => {
      expect(describeDuration(120000)).toBe('2m')
      expect(describeDuration(600000)).toBe('10m')
    })

    it('should switch to hours before minutes reach three digits', () => {
      expect(describeDuration(5399000)).toBe('90m')
      expect(describeDuration(5400000)).toBe('1.5h')
      expect(describeDuration(86400000)).toBe('24.0h')
    })

    it('should not report a negative duration', () => {
      expect(describeDuration(-5000)).toBe('0s')
    })
  })
})
