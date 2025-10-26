const { Transform } = require('stream')
const { checksum } = require('../lib/checksum')
const { parseValues } = require('../lib/value-parser')

class VEDirectParser extends Transform {
  constructor () {
    super({
      readableObjectMode: true
    })

    this.buf = Buffer.alloc(0)
    this.blk = {}
  }

  _transform (chunk, _, cb) {
    const [key, val] = chunk.toString().split('\t')

    // Skip hex commands (starting with ':')
    if (key[0] === ':') {
      return cb()
    }

    this.buf = Buffer.concat([this.buf, Buffer.from([0x0d, 0x0a]), chunk])

    if (key === 'Checksum') {
      if (checksum(this.buf) === 0) {
        this.push(parseValues(this.blk))
      }

      this.buf = Buffer.alloc(0)
      this.blk = {}
    } else {
      this.blk[key] = val
    }

    cb()
  }
}

module.exports = VEDirectParser
