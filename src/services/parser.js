const { Transform } = require('stream')

const checksum = (blockBuffer) => {
  return blockBuffer.reduce((prev, curr) => {
    return (prev + curr) & 255
  }, 0)
}

const parseValues = (frame) => {
  for (const key in frame) {
    switch (key) {
      case 'V':
        frame[key] = {
          value: frame[key],
          description: 'Main or channel 1 (battery) voltage',
          units: 'mV'
        }
        break
      case 'V2':
        frame[key] = {
          value: frame[key],
          description: 'Channel 2 (battery) voltage',
          units: 'mV'
        }
        break
      case 'V3':
        frame[key] = {
          value: frame[key],
          description: 'Channel 3 (battery) voltage',
          units: 'mV'
        }
        break
      case 'VS':
        frame[key] = {
          value: frame[key],
          description: 'Auxiliary (starter) voltage',
          units: 'mV'
        }
        break
      case 'VM':
        frame[key] = {
          value: frame[key],
          description: 'Mid-point voltage of the battery bank',
          units: 'mV'
        }
        break
      case 'DM':
        frame[key] = {
          value: frame[key],
          description: 'Mid-point deviation of the battery bank',
          units: '‰'
        }
        break
      case 'VPV':
        frame[key] = {
          value: frame[key],
          description: 'Panel voltage',
          units: 'mV'
        }
        break
      case 'PPV':
        frame[key] = {
          value: frame[key],
          description: 'Panel power',
          units: 'W'
        }
        break
      case 'I':
        frame[key] = {
          value: frame[key],
          description: 'Main or channel 1 battery current',
          units: 'mA'
        }
        break
      case 'I2':
        frame[key] = {
          value: frame[key],
          description: 'Channel 2 battery current',
          units: 'mA'
        }
        break
      case 'I3':
        frame[key] = {
          value: frame[key],
          description: 'Channel 3 battery current',
          units: 'mA'
        }
        break
      case 'IL':
        frame[key] = {
          value: frame[key],
          description: 'Load current',
          units: 'mA'
        }
        break
      case 'LOAD':
        frame[key] = {
          value: frame[key],
          description: 'Load output state (ON/OFF)',
          units: 'W'
        }
        break
      case 'T':
        frame[key] = {
          value: frame[key],
          description: 'Battery temperature',
          units: '°C'
        }
        break
      case 'P':
        frame[key] = {
          value: frame[key],
          description: 'Instantaneous power',
          units: 'W'
        }
        break
      case 'CE':
        frame[key] = {
          value: frame[key],
          description: 'Consumed Amp Hours',
          units: 'mAh'
        }
        break
      case 'SOC':
        frame[key] = {
          value: frame[key],
          description: 'State-of-charge',
          units: '‰'
        }
        break
      case 'TTG':
        frame[key] = {
          value: frame[key],
          description: 'Time-to-go',
          units: 'Minutes'
        }
        break
      case 'Alarm':
        frame[key] = {
          value: frame[key],
          description: 'Alarm condition active',
          units: ''
        }
        break
      case 'Relay':
        frame[key] = {
          value: frame[key],
          description: 'Relay state',
          units: ''
        }
        break
      case 'AR':
        frame[key] = {
          value: frame[key],
          description: 'Alarm reason',
          units: ''
        }
        break
      case 'OR':
        frame[key] = {
          value: frame[key],
          description: 'Off reason',
          units: ''
        }
        break
      case 'H1':
        frame[key] = {
          value: frame[key],
          description: 'Depth of the deepest discharge',
          units: 'mAh'
        }
        break
      case 'H2':
        frame[key] = {
          value: frame[key],
          description: 'Depth of the last discharge',
          units: 'mAh'
        }
        break
      case 'H3':
        frame[key] = {
          value: frame[key],
          description: 'Depth of the average discharge',
          units: 'mAh'
        }
        break
      case 'H4':
        frame[key] = {
          value: frame[key],
          description: 'Number of charge cycles',
          units: ''
        }
        break
      case 'H5':
        frame[key] = {
          value: frame[key],
          description: 'Number of full discharges',
          units: ''
        }
        break
      case 'H6':
        frame[key] = {
          value: frame[key],
          description: 'Cumulative Amp Hours drawn',
          units: 'mAh'
        }
        break
      case 'H7':
        frame[key] = {
          value: frame[key],
          description: 'Minimum main (battery) voltage',
          units: 'mV'
        }
        break
      case 'H8':
        frame[key] = {
          value: frame[key],
          description: 'Maximum main (battery) voltage',
          units: 'mV'
        }
        break
      case 'H9':
        frame[key] = {
          value: frame[key],
          description: 'Number of seconds since last full charge',
          units: 'Seconds'
        }
        break
      case 'H10':
        frame[key] = {
          value: frame[key],
          description: 'Number of automatic synchronizations',
          units: ''
        }
        break
      case 'H11':
        frame[key] = {
          value: frame[key],
          description: 'Number of low main voltage alarms',
          units: ''
        }
        break
      case 'H12':
        frame[key] = {
          value: frame[key],
          description: 'Number of high main voltage alarms',
          units: ''
        }
        break
      case 'H13':
        frame[key] = {
          value: frame[key],
          description: 'Number of low auxiliary voltage alarms',
          units: ''
        }
        break
      case 'H14':
        frame[key] = {
          value: frame[key],
          description: 'Number of high auxiliary voltage alarms',
          units: ''
        }
        break
      case 'H15':
        frame[key] = {
          value: frame[key],
          description: 'Minimum auxiliary (battery) voltage',
          units: 'mV'
        }
        break
      case 'H16':
        frame[key] = {
          value: frame[key],
          description: 'Maximum auxiliary (battery) voltage',
          units: 'mV'
        }
        break
      case 'H17':
        frame[key] = {
          value: frame[key],
          description: 'Amount of discharged energy (BMV) / Amount of produced energy (DC monitor)',
          units: '0.01 kWh'
        }
        break
      case 'H18':
        frame[key] = {
          value: frame[key],
          description: 'Amount of charged energy (BMV) / Amount of consumed energy (DC monitor)',
          units: '0.01 kWh'
        }
        break
      case 'H19':
        frame[key] = {
          value: frame[key],
          description: 'Yield total (user resettable counter)',
          units: '0.01 kWh'
        }
        break
      case 'H20':
        frame[key] = {
          value: frame[key],
          description: 'Yield today',
          units: '0.01 kWh'
        }
        break
      case 'H21':
        frame[key] = {
          value: frame[key],
          description: 'Maximum power today',
          units: 'W'
        }
        break
      case 'H22':
        frame[key] = {
          value: frame[key],
          description: 'Yield yesterday',
          units: '0.01 kWh'
        }
        break
      case 'H23':
        frame[key] = {
          value: frame[key],
          description: 'Maximum power yesterday',
          units: 'W'
        }
        break
      case 'ERR':
        frame[key] = {
          value: frame[key],
          description: 'Error code',
          units: ''
        }
        break
      case 'CS':
        frame[key] = {
          value: frame[key],
          description: 'State of operation',
          units: ''
        }
        break
      case 'BMV':
        frame[key] = {
          value: frame[key],
          description: 'Model description (deprecated)',
          units: ''
        }
        break
      case 'FW':
        frame[key] = {
          value: frame[key],
          description: 'Firmware version (16 bit)',
          units: ''
        }
        break
      case 'FWE':
        frame[key] = {
          value: frame[key],
          description: 'Firmware version (24 bit)',
          units: ''
        }
        break
      case 'PID':
        frame[key] = {
          value: frame[key],
          description: 'ProductID',
          units: ''
        }
        break
      case 'SER#':
        frame[key] = {
          value: frame[key],
          description: 'Serial number',
          units: ''
        }
        break
      case 'HSDS':
        frame[key] = {
          value: frame[key],
          description: 'Day sequence number (0..364)',
          units: ''
        }
        break
      case 'MODE':
        frame[key] = {
          value: frame[key],
          description: 'Device mode',
          units: ''
        }
        break
      case 'AC_OUT_V':
        frame[key] = {
          value: frame[key],
          description: 'AC output voltage',
          units: '0.01 V'
        }
        break
      case 'AC_OUT_I':
        frame[key] = {
          value: frame[key],
          description: 'AC output current',
          units: '0.1 A'
        }
        break
      case 'AC_OUT_S':
        frame[key] = {
          value: frame[key],
          description: 'AC output apparent power',
          units: 'VA'
        }
        break
      case 'WARN':
        frame[key] = {
          value: frame[key],
          description: 'Warning reason',
          units: ''
        }
        break
      case 'MPPT':
        frame[key] = {
          value: frame[key],
          description: 'Tracker operation mode',
          units: ''
        }
        break
      case 'MON':
        frame[key] = {
          value: frame[key],
          description: 'DC monitor mode',
          units: ''
        }
        break
      default:
        frame[key] = {
          value: frame[key],
          description: 'Non implemented key',
          units: ''
        }
        break
    }
    frame[key].value = parseFloat(frame[key].value) || frame[key].value
    if (frame[key].value === '0') {
      frame[key].value = 0
    }
  }

  return frame
}

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
module.exports.checksum = checksum
