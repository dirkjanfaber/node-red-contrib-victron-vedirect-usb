const { getProductName } = require('./products')
const { getFieldDefinition } = require('./field-definitions')

/**
 * Parse a single field value
 * @param {string} key - The field key
 * @param {string} value - The raw value string
 * @returns {Object} Parsed field object with value, description, units, and optionally product
 */
function parseField (key, value) {
  const definition = getFieldDefinition(key)
  const parsedValue = parseFloat(value) || value

  const field = {
    value: parsedValue === '0' ? 0 : parsedValue,
    description: definition.description,
    units: definition.units
  }

  // Add product name for PID field
  if (key === 'PID') {
    const productName = getProductName(value)
    if (productName) {
      field.product = productName
    }
  }

  return field
}

/**
 * Parse all fields in a frame
 * @param {Object} frame - Raw frame object with key-value pairs
 * @returns {Object} Parsed frame with all fields enhanced with metadata
 */
function parseValues (frame) {
  const parsed = {}

  for (const key in frame) {
    parsed[key] = parseField(key, frame[key])
  }

  return parsed
}

module.exports = { parseField, parseValues }
