/**
 * VE.Direct field definitions
 * Maps field keys to their descriptions and units
 */
const fieldDefinitions = {
  V: { description: 'Main or channel 1 (battery) voltage', units: 'mV' },
  V2: { description: 'Channel 2 (battery) voltage', units: 'mV' },
  V3: { description: 'Channel 3 (battery) voltage', units: 'mV' },
  VS: { description: 'Auxiliary (starter) voltage', units: 'mV' },
  VM: { description: 'Mid-point voltage of the battery bank', units: 'mV' },
  DM: { description: 'Mid-point deviation of the battery bank', units: '‰' },
  VPV: { description: 'Panel voltage', units: 'mV' },
  PPV: { description: 'Panel power', units: 'W' },
  I: { description: 'Main or channel 1 battery current', units: 'mA' },
  I2: { description: 'Channel 2 battery current', units: 'mA' },
  I3: { description: 'Channel 3 battery current', units: 'mA' },
  IL: { description: 'Load current', units: 'mA' },
  LOAD: { description: 'Load output state (ON/OFF)', units: 'W' },
  T: { description: 'Battery temperature', units: '°C' },
  P: { description: 'Instantaneous power', units: 'W' },
  CE: { description: 'Consumed Amp Hours', units: 'mAh' },
  SOC: { description: 'State-of-charge', units: '‰' },
  TTG: { description: 'Time-to-go', units: 'Minutes' },
  Alarm: { description: 'Alarm condition active', units: '' },
  Relay: { description: 'Relay state', units: '' },
  AR: { description: 'Alarm reason', units: '' },
  OR: { description: 'Off reason', units: '' },
  H1: { description: 'Depth of the deepest discharge', units: 'mAh' },
  H2: { description: 'Depth of the last discharge', units: 'mAh' },
  H3: { description: 'Depth of the average discharge', units: 'mAh' },
  H4: { description: 'Number of charge cycles', units: '' },
  H5: { description: 'Number of full discharges', units: '' },
  H6: { description: 'Cumulative Amp Hours drawn', units: 'mAh' },
  H7: { description: 'Minimum main (battery) voltage', units: 'mV' },
  H8: { description: 'Maximum main (battery) voltage', units: 'mV' },
  H9: { description: 'Number of seconds since last full charge', units: 'Seconds' },
  H10: { description: 'Number of automatic synchronizations', units: '' },
  H11: { description: 'Number of low main voltage alarms', units: '' },
  H12: { description: 'Number of high main voltage alarms', units: '' },
  H13: { description: 'Number of low auxiliary voltage alarms', units: '' },
  H14: { description: 'Number of high auxiliary voltage alarms', units: '' },
  H15: { description: 'Minimum auxiliary (battery) voltage', units: 'mV' },
  H16: { description: 'Maximum auxiliary (battery) voltage', units: 'mV' },
  H17: { description: 'Amount of discharged energy (BMV) / Amount of produced energy (DC monitor)', units: '0.01 kWh' },
  H18: { description: 'Amount of charged energy (BMV) / Amount of consumed energy (DC monitor)', units: '0.01 kWh' },
  H19: { description: 'Yield total (user resettable counter)', units: '0.01 kWh' },
  H20: { description: 'Yield today', units: '0.01 kWh' },
  H21: { description: 'Maximum power today', units: 'W' },
  H22: { description: 'Yield yesterday', units: '0.01 kWh' },
  H23: { description: 'Maximum power yesterday', units: 'W' },
  ERR: { description: 'Error code', units: '' },
  CS: { description: 'State of operation', units: '' },
  BMV: { description: 'Model description (deprecated)', units: '' },
  FW: { description: 'Firmware version (16 bit)', units: '' },
  FWE: { description: 'Firmware version (24 bit)', units: '' },
  PID: { description: 'ProductID', units: '' },
  'SER#': { description: 'Serial number', units: '' },
  HSDS: { description: 'Day sequence number (0..364)', units: '' },
  MODE: { description: 'Device mode', units: '' },
  AC_OUT_V: { description: 'AC output voltage', units: '0.01 V' },
  AC_OUT_I: { description: 'AC output current', units: '0.1 A' },
  AC_OUT_S: { description: 'AC output apparent power', units: 'VA' },
  WARN: { description: 'Warning reason', units: '' },
  MPPT: { description: 'Tracker operation mode', units: '' },
  MON: { description: 'DC monitor mode', units: '' },
  DC_IN_V: { description: 'DC input voltage', units: '0.01 V' },
  DC_IN_I: { description: 'DC input current', units: '0.1 A' },
  DC_IN_P: { description: 'DC input power', units: '1 W' }
}

/**
 * Get field definition for a given key
 * @param {string} key - The field key
 * @returns {Object} The field definition with description and units
 */
function getFieldDefinition (key) {
  return fieldDefinitions[key] || { description: 'Non implemented key', units: '' }
}

module.exports = { fieldDefinitions, getFieldDefinition }
