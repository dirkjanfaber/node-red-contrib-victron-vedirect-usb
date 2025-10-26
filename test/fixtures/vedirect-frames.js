/**
 * Sample VE.Direct data frames for testing
 */

// SmartShunt sample data
const smartShuntFrame = {
  V: '12850',
  I: '0',
  P: '0',
  CE: '-123',
  SOC: '1000',
  TTG: '-1',
  Alarm: 'OFF',
  Relay: 'OFF',
  AR: '0',
  H1: '-1234',
  H2: '-567',
  H3: '-890',
  H4: '12',
  H5: '3',
  H6: '-45678',
  H7: '11500',
  H8: '14200',
  H9: '3600',
  H10: '5',
  H11: '0',
  H12: '0',
  H17: '12345',
  H18: '23456',
  PID: '0xA389',
  'SER#': 'HQ2123ABCDE',
  FW: '0419',
  Checksum: 'r'
}

// MPPT Solar Charger sample data
const mpptFrame = {
  V: '13200',
  VPV: '18500',
  PPV: '65',
  I: '5000',
  IL: '0',
  LOAD: 'ON',
  H19: '1234',
  H20: '45',
  H21: '85',
  H22: '67',
  H23: '120',
  ERR: '0',
  CS: '3',
  FW: '159',
  PID: '0xA053',
  'SER#': 'HQ2234FGHIJ',
  HSDS: '123',
  Checksum: 'e'
}

// BMV sample data
const bmvFrame = {
  V: '12750',
  VS: '13100',
  I: '-2500',
  P: '-32',
  CE: '-5678',
  SOC: '875',
  TTG: '240',
  Alarm: 'OFF',
  Relay: 'OFF',
  AR: '0',
  BMV: '700',
  FW: '307',
  PID: '0x203',
  'SER#': 'HQ1912KLMNO',
  H1: '-12345',
  H2: '-2345',
  H3: '-3456',
  H4: '234',
  H5: '12',
  H6: '-123456',
  H7: '10500',
  H8: '14500',
  H9: '7200',
  H10: '45',
  H11: '2',
  H12: '1',
  H13: '0',
  H14: '0',
  H15: '11800',
  H16: '13500',
  H17: '45678',
  H18: '56789',
  Checksum: 'x'
}

// Phoenix Inverter sample data
const phoenixFrame = {
  V: '12600',
  I: '8500',
  AC_OUT_V: '23010',
  AC_OUT_I: '35',
  AC_OUT_S: '800',
  CS: '9',
  MODE: '2',
  WARN: '0',
  PID: '0xA201',
  'SER#': 'HQ2045PQRST',
  FW: '1234',
  Checksum: 'y'
}

// Minimal frame
const minimalFrame = {
  V: '12000',
  I: '0',
  PID: '0xA389',
  Checksum: 'a'
}

// Frame with unknown product
const unknownProductFrame = {
  V: '12500',
  I: '100',
  PID: '0xFFFF',
  'SER#': 'UNKNOWN123',
  Checksum: 'b'
}

module.exports = {
  smartShuntFrame,
  mpptFrame,
  bmvFrame,
  phoenixFrame,
  minimalFrame,
  unknownProductFrame
}
