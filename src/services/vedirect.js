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

class VEDirect extends EventEmitter {
  constructor (path) {
    super()

    debugSerial('Creating serial port on %s', path)

    this.serial = new SerialPort({
      path,
      baudRate: 19200,
      dataBits: 8,
      parity: 'none'
    })

    this.serial.on('open', () => {
      debugSerial('Serial port opened successfully')
    })

    this.serial.on('error', (err) => {
      debugSerial('Serial port error: %o', err)
      this.emit('error', err)
    })

    this.serial.on('data', (data) => {
      debugSerial('Received %d bytes: %s', data.length, data.toString('hex').substring(0, 40))
    })

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
    const outputStream = new Writable({
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
    this.serial.pipe(this.rl).pipe(this.ve).pipe(outputStream)

    debugSerial('Pipe chain established')
  }
}

module.exports = VEDirect