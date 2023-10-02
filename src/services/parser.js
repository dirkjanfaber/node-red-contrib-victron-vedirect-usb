const { Transform } = require('stream')

const checksum = (blockBuffer) => {
  return blockBuffer.reduce((prev, curr) => {
    return (prev + curr) & 255
  }, 0)
}

const products = {
  '0x203': 'BMV-700',
  '0x204': 'BMV-702',
  '0x205': 'BMV-700H',
  '0x0300': 'BlueSolar MPPT 70|15',
  '0xA040': 'BlueSolar MPPT 75|50',
  '0xA041': 'BlueSolar MPPT 150|35',
  '0xA042': 'BlueSolar MPPT 75|15',
  '0xA043': 'BlueSolar MPPT 100|15',
  '0xA044': 'BlueSolar MPPT 100|30',
  '0xA045': 'BlueSolar MPPT 100|50',
  '0xA046': 'BlueSolar MPPT 150|70',
  '0xA047': 'BlueSolar MPPT 150|100',
  '0xA049': 'BlueSolar MPPT 100|50 rev2',
  '0xA04A': 'BlueSolar MPPT 100|30 rev2',
  '0xA04B': 'BlueSolar MPPT 150|35 rev2',
  '0xA04C': 'BlueSolar MPPT 75|10',
  '0xA04D': 'BlueSolar MPPT 150|45',
  '0xA04E': 'BlueSolar MPPT 150|60',
  '0xA04F': 'BlueSolar MPPT 150|85',
  '0xA050': 'SmartSolar MPPT 250|100',
  '0xA051': 'SmartSolar MPPT 150|100',
  '0xA052': 'SmartSolar MPPT 150|85',
  '0xA053': 'SmartSolar MPPT 75|15',
  '0xA054': 'SmartSolar MPPT 75|10',
  '0xA055': 'SmartSolar MPPT 100|15',
  '0xA056': 'SmartSolar MPPT 100|30',
  '0xA057': 'SmartSolar MPPT 100|50',
  '0xA058': 'SmartSolar MPPT 150|35',
  '0xA059': 'SmartSolar MPPT 150|100 rev2',
  '0xA05A': 'SmartSolar MPPT 150|85 rev2',
  '0xA05B': 'SmartSolar MPPT 250|70',
  '0xA05C': 'SmartSolar MPPT 250|85',
  '0xA05D': 'SmartSolar MPPT 250|60',
  '0xA05E': 'SmartSolar MPPT 250|45',
  '0xA05F': 'SmartSolar MPPT 100|20',
  '0xA060': 'SmartSolar MPPT 100|20 48V',
  '0xA061': 'SmartSolar MPPT 150|45',
  '0xA062': 'SmartSolar MPPT 150|60',
  '0xA063': 'SmartSolar MPPT 150|70',
  '0xA064': 'SmartSolar MPPT 250|85 rev2',
  '0xA065': 'SmartSolar MPPT 250|100 rev2',
  '0xA066': 'BlueSolar MPPT 100|20',
  '0xA067': 'BlueSolar MPPT 100|20 48V',
  '0xA068': 'SmartSolar MPPT 250|60 rev2',
  '0xA069': 'SmartSolar MPPT 250|70 rev2',
  '0xA06A': 'SmartSolar MPPT 150|45 rev2',
  '0xA06B': 'SmartSolar MPPT 150|60 rev2',
  '0xA06C': 'SmartSolar MPPT 150|70 rev2',
  '0xA06D': 'SmartSolar MPPT 150|85 rev3',
  '0xA06E': 'SmartSolar MPPT 150|100 rev3',
  '0xA06F': 'BlueSolar MPPT 150|45 rev2',
  '0xA070': 'BlueSolar MPPT 150|60 rev2',
  '0xA071': 'BlueSolar MPPT 150|70 rev2',
  '0xA072': 'BlueSolar MPPT 150/45 rev3',
  '0xA073': 'SmartSolar MPPT 150/45 rev3',
  '0xA074': 'SmartSolar MPPT 75/10 rev2',
  '0xA075': 'SmartSolar MPPT 75/15 rev2',
  '0xA076': 'BlueSolar MPPT 100/30 rev3',
  '0xA077': 'BlueSolar MPPT 100/50 rev3',
  '0xA078': 'BlueSolar MPPT 150/35 rev3',
  '0xA079': 'BlueSolar MPPT 75/10 rev2',
  '0xA07A': 'BlueSolar MPPT 75/15 rev2',
  '0xA07B': 'BlueSolar MPPT 100/15 rev2',
  '0xA07C': 'BlueSolar MPPT 75/10 rev3',
  '0xA07D': 'BlueSolar MPPT 75/15 rev3',
  '0xA07E': 'SmartSolar MPPT 100/30 12V',
  '0xA07F': 'All-In-1 SmartSolar MPPT 75/15 12V',
  '0xA102': 'SmartSolar MPPT VE.Can 150/70',
  '0xA103': 'SmartSolar MPPT VE.Can 150/45',
  '0xA104': 'SmartSolar MPPT VE.Can 150/60',
  '0xA105': 'SmartSolar MPPT VE.Can 150/85',
  '0xA106': 'SmartSolar MPPT VE.Can 150/100',
  '0xA107': 'SmartSolar MPPT VE.Can 250/45',
  '0xA108': 'SmartSolar MPPT VE.Can 250/60',
  '0xA109': 'SmartSolar MPPT VE.Can 250/70',
  '0xA10A': 'SmartSolar MPPT VE.Can 250/85',
  '0xA10B': 'SmartSolar MPPT VE.Can 250/100',
  '0xA10C': 'SmartSolar MPPT VE.Can 150/70 rev2',
  '0xA10D': 'SmartSolar MPPT VE.Can 150/85 rev2',
  '0xA10E': 'SmartSolar MPPT VE.Can 150/100 rev2',
  '0xA10F': 'BlueSolar MPPT VE.Can 150/100',
  '0xA112': 'BlueSolar MPPT VE.Can 250/70',
  '0xA113': 'BlueSolar MPPT VE.Can 250/100',
  '0xA114': 'SmartSolar MPPT VE.Can 250/70 rev2',
  '0xA115': 'SmartSolar MPPT VE.Can 250/100 rev2',
  '0xA116': 'SmartSolar MPPT VE.Can 250/85 rev2',
  '0xA201': 'Phoenix Inverter 12V 250VA 230V',
  '0xA202': 'Phoenix Inverter 24V 250VA 230V',
  '0xA204': 'Phoenix Inverter 48V 250VA 230V',
  '0xA211': 'Phoenix Inverter 12V 375VA 230V',
  '0xA212': 'Phoenix Inverter 24V 375VA 230V',
  '0xA214': 'Phoenix Inverter 48V 375VA 230V',
  '0xA221': 'Phoenix Inverter 12V 500VA 230V',
  '0xA222': 'Phoenix Inverter 24V 500VA 230V',
  '0xA224': 'Phoenix Inverter 48V 500VA 230V',
  '0xA231': 'Phoenix Inverter 12V 250VA 230V',
  '0xA232': 'Phoenix Inverter 24V 250VA 230V',
  '0xA234': 'Phoenix Inverter 48V 250VA 230V',
  '0xA239': 'Phoenix Inverter 12V 250VA 120V',
  '0xA23A': 'Phoenix Inverter 24V 250VA 120V',
  '0xA23C': 'Phoenix Inverter 48V 250VA 120V',
  '0xA241': 'Phoenix Inverter 12V 375VA 230V',
  '0xA242': 'Phoenix Inverter 24V 375VA 230V',
  '0xA244': 'Phoenix Inverter 48V 375VA 230V',
  '0xA249': 'Phoenix Inverter 12V 375VA 120V',
  '0xA24A': 'Phoenix Inverter 24V 375VA 120V',
  '0xA24C': 'Phoenix Inverter 48V 375VA 120V',
  '0xA251': 'Phoenix Inverter 12V 500VA 230V',
  '0xA252': 'Phoenix Inverter 24V 500VA 230V',
  '0xA254': 'Phoenix Inverter 48V 500VA 230V',
  '0xA259': 'Phoenix Inverter 12V 500VA 120V',
  '0xA25A': 'Phoenix Inverter 24V 500VA 120V',
  '0xA25C': 'Phoenix Inverter 48V 500VA 120V',
  '0xA261': 'Phoenix Inverter 12V 800VA 230V',
  '0xA262': 'Phoenix Inverter 24V 800VA 230V',
  '0xA264': 'Phoenix Inverter 48V 800VA 230V',
  '0xA269': 'Phoenix Inverter 12V 800VA 120V',
  '0xA26A': 'Phoenix Inverter 24V 800VA 120V',
  '0xA26C': 'Phoenix Inverter 48V 800VA 120V',
  '0xA271': 'Phoenix Inverter 12V 1200VA 230V',
  '0xA272': 'Phoenix Inverter 24V 1200VA 230V',
  '0xA274': 'Phoenix Inverter 48V 1200VA 230V',
  '0xA279': 'Phoenix Inverter 12V 1200VA 120V',
  '0xA27A': 'Phoenix Inverter 24V 1200VA 120V',
  '0xA27C': 'Phoenix Inverter 48V 1200VA 120V',
  '0xA281': 'Phoenix Inverter 12V 1600VA 230V',
  '0xA282': 'Phoenix Inverter 24V 1600VA 230V',
  '0xA284': 'Phoenix Inverter 48V 1600VA 230V',
  '0xA291': 'Phoenix Inverter 12V 2000VA 230V',
  '0xA292': 'Phoenix Inverter 24V 2000VA 230V',
  '0xA294': 'Phoenix Inverter 48V 2000VA 230V',
  '0xA2A1': 'Phoenix Inverter 12V 3000VA 230V',
  '0xA2A2': 'Phoenix Inverter 24V 3000VA 230V',
  '0xA2A4': 'Phoenix Inverter 48V 3000VA 230V',
  '0xA340': 'Phoenix Smart IP43 Charger 12|50 (1+1)',
  '0xA341': 'Phoenix Smart IP43 Charger 12|50 (3)',
  '0xA342': 'Phoenix Smart IP43 Charger 24|25 (1+1)',
  '0xA343': 'Phoenix Smart IP43 Charger 24|25 (3)',
  '0xA344': 'Phoenix Smart IP43 Charger 12|30 (1+1)',
  '0xA345': 'Phoenix Smart IP43 Charger 12|30 (3)',
  '0xA346': 'Phoenix Smart IP43 Charger 24|16 (1+1)',
  '0xA347': 'Phoenix Smart IP43 Charger 24|16 (3)',
  '0xA381': 'BMV-712 Smart',
  '0xA382': 'BMV-710H Smart',
  '0xA383': 'BMV-712 Smart Rev2',
  '0xA389': 'SmartShunt 500A/50mV',
  '0xA38A': 'SmartShunt 1000A/50mV',
  '0xA38B': 'SmartShunt 2000A/50mV',
  '0xA3F0': 'Smart BuckBoost 12V/12V-50A'
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
          product: products[frame[key]],
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
      case 'DC_IN_V':
        frame[key] = {
          value: frame[key],
          description: 'DC input voltage',
          units: '0.01 V'
        }
        break
      case 'DC_IN_I':
        frame[key] = {
          value: frame[key],
          description: 'DC input current',
          units: '0.1 A'
        }
        break
      case 'DC_IN_P':
        frame[key] = {
          value: frame[key],
          description: 'DC input power',
          units: '1 W'
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
