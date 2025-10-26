const VEDirectParser = require('../../../src/services/parser')
const { Writable } = require('stream')

// Helper function to calculate the checksum BYTE value (not ASCII text!)
// The checksum is a single byte that makes the sum of all bytes in the frame equal to 0 mod 256
function calculateChecksumByte(lines) {
  let buffer = Buffer.alloc(0)

  // Build buffer the same way the parser does
  lines.forEach(line => {
    buffer = Buffer.concat([
      buffer,
      Buffer.from([0x0d, 0x0a]), // \r\n
      Buffer.from(line)
    ])
  })

  // Add the checksum line prefix: \r\n + "Checksum\t"
  const checksumPrefix = Buffer.concat([
    Buffer.from([0x0d, 0x0a]),
    Buffer.from('Checksum\t')
  ])

  buffer = Buffer.concat([buffer, checksumPrefix])

  // Calculate sum of all bytes so far
  const sum = buffer.reduce((prev, curr) => (prev + curr) & 255, 0)

  // The checksum byte value that will make the total sum 0 (mod 256)
  return (256 - sum) & 255
}

// Helper to create a properly checksummed frame
// Returns array of Buffer chunks INCLUDING the checksum as a SINGLE BYTE
function createFrameWithChecksum(lines) {
  const checksumByte = calculateChecksumByte(lines)

  // Create the checksum line: "Checksum\t" + single byte
  const checksumLine = Buffer.concat([
    Buffer.from('Checksum\t'),
    Buffer.from([checksumByte])  // Single byte, not ASCII text!
  ])

  return [
    ...lines.map(line => Buffer.from(line)),
    checksumLine
  ]
}

describe('VEDirectParser', () => {
  let parser
  let receivedData

  beforeEach(() => {
    parser = new VEDirectParser()
    receivedData = []

    // Capture emitted data
    const writer = new Writable({
      objectMode: true,
      write (chunk, encoding, callback) {
        receivedData.push(chunk)
        callback()
      }
    })

    parser.pipe(writer)
  })

  afterEach(() => {
    parser.destroy()
  })

  test('should be a Transform stream', () => {
    expect(parser).toBeInstanceOf(require('stream').Transform)
  })

  test('should parse simple valid frame', (done) => {
    const frame = createFrameWithChecksum([
      'V\t12450',
      'I\t1500'
    ])

    frame.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      expect(receivedData.length).toBe(1)
      expect(receivedData[0].V.value).toBe(12450)
      expect(receivedData[0].I.value).toBe(1500)
      done()
    }, 50)
  })

  test('should skip hex commands (lines starting with ":")', (done) => {
    const frame = [
      Buffer.from(':7123400AB'),
      ...createFrameWithChecksum([
        'V\t12450'
      ])
    ]

    frame.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      expect(receivedData.length).toBe(1)
      expect(receivedData[0].V).toBeDefined()
      done()
    }, 50)
  })

  test('should handle multiple frames', (done) => {
    const frame1 = createFrameWithChecksum([
      'V\t12450'
    ])

    const frame2 = createFrameWithChecksum([
      'V\t12500'
    ])

    frame1.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      frame2.forEach(chunk => parser.write(chunk))

      setTimeout(() => {
        expect(receivedData.length).toBe(2)
        expect(receivedData[0].V.value).toBe(12450)
        expect(receivedData[1].V.value).toBe(12500)
        done()
      }, 50)
    }, 50)
  })

  test('should not emit data for frame with invalid checksum', (done) => {
    // Create a frame with intentionally wrong checksum
    const frame = [
      Buffer.from('V\t12450'),
      Buffer.from('I\t1500'),
      Buffer.from('Checksum\t\x99') // Wrong checksum byte
    ]

    frame.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      expect(receivedData.length).toBe(0)
      done()
    }, 50)
  })

  test('should reset buffer and block after processing checksum', (done) => {
    const frame1 = createFrameWithChecksum([
      'V\t12450'
    ])

    const frame2 = createFrameWithChecksum([
      'I\t1500'
    ])

    frame1.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      frame2.forEach(chunk => parser.write(chunk))

      setTimeout(() => {
        expect(receivedData.length).toBe(2)
        expect(receivedData[0].V).toBeDefined()
        expect(receivedData[0].I).toBeUndefined()
        expect(receivedData[1].I).toBeDefined()
        expect(receivedData[1].V).toBeUndefined()
        done()
      }, 50)
    }, 50)
  })

  test('should handle frame with PID field', (done) => {
    const frame = createFrameWithChecksum([
      'PID\t0xA389',
      'V\t12850'
    ])

    frame.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      expect(receivedData.length).toBe(1)
      expect(receivedData[0].PID.value).toBe('0xA389')
      expect(receivedData[0].PID.product).toBe('SmartShunt 500A/50mV')
      done()
    }, 50)
  })

  test('should handle special characters in serial number', (done) => {
    const frame = createFrameWithChecksum([
      'SER#\tHQ2123ABCDE',
      'V\t12450'
    ])

    frame.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      expect(receivedData.length).toBe(1)
      expect(receivedData[0]['SER#'].value).toBe('HQ2123ABCDE')
      done()
    }, 50)
  })

  test('should handle empty values', (done) => {
    const frame = createFrameWithChecksum([
      'V\t'
    ])

    frame.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      expect(receivedData.length).toBe(1)
      expect(receivedData[0].V.value).toBe('')
      done()
    }, 50)
  })

  test('should accumulate buffer correctly', (done) => {
    const frame = createFrameWithChecksum([
      'V\t12450',
      'I\t1500',
      'P\t18'
    ])

    frame.forEach(chunk => parser.write(chunk))

    setTimeout(() => {
      expect(receivedData.length).toBe(1)
      const data = receivedData[0]
      expect(data.V.value).toBe(12450)
      expect(data.I.value).toBe(1500)
      expect(data.P.value).toBe(18)
      done()
    }, 50)
  })
})
