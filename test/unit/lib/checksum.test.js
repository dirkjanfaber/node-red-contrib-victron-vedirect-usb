const { checksum } = require('../../../src/lib/checksum')

describe('checksum', () => {
  test('should return 0 for empty buffer', () => {
    const buffer = Buffer.alloc(0)
    expect(checksum(buffer)).toBe(0)
  })

  test('should calculate correct checksum for simple buffer', () => {
    const buffer = Buffer.from([1, 2, 3])
    expect(checksum(buffer)).toBe(6)
  })

  test('should handle overflow correctly (AND with 255)', () => {
    const buffer = Buffer.from([255, 255])
    expect(checksum(buffer)).toBe(254) // (255 + 255) & 255 = 254
  })

  test('should return 0 for valid VE.Direct block with checksum', () => {
    // Example VE.Direct block with valid checksum
    // V\t12345\r\nChecksum\t<calculated>
    const block = Buffer.from('\r\nV\t12345\r\nChecksum\t', 'ascii')
    // Add the checksum byte that makes the total checksum 0
    const currentChecksum = checksum(block)
    const checksumByte = (256 - currentChecksum) & 255
    const fullBlock = Buffer.concat([block, Buffer.from([checksumByte])])
    
    expect(checksum(fullBlock)).toBe(0)
  })

  test('should handle large values', () => {
    const buffer = Buffer.from([100, 150, 200, 250])
    const result = checksum(buffer)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(255)
  })

  test('should be commutative', () => {
    const buffer1 = Buffer.from([10, 20, 30])
    const buffer2 = Buffer.from([30, 20, 10])
    expect(checksum(buffer1)).toBe(checksum(buffer2))
  })
})
