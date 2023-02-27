const { SerialPort } = require('serialport')
const { DelimiterParser } = require('@serialport/parser-delimiter')
const VEDirectParser = require('../services/parser')
const { EventEmitter } = require('events')

class VEDirect extends EventEmitter {
  constructor (path) {
    super()

    this.serial = new SerialPort({
      path,
      baudRate: 19200,
      dataBits: 8,
      parity: 'none'
    })

    this.rl = new DelimiterParser({
      delimiter: Buffer.from([0x0d, 0x0a], 'hex'),
      includeDelimiter: false
    })

    this.ve = new VEDirectParser()

    this.ve.on('data', (data) => {
      this.emit('data', data)
    })

    this.serial.pipe(this.rl).pipe(this.ve)
  }
}

module.exports = VEDirect
