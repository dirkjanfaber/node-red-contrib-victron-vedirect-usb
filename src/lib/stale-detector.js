/**
 * Stale data detection utilities
 * Pure functions for detecting when data becomes stale based on timeout configuration
 */

/**
 * Parse timeout configuration value
 * @param {*} configValue - The timeout value from node configuration
 * @returns {number|null} Timeout in milliseconds, or null if disabled
 */
function parseTimeout (configValue) {
  if (configValue === undefined || configValue === null || configValue === '') {
    return null
  }
  
  const parsed = parseFloat(configValue)
  if (isNaN(parsed) || parsed <= 0) {
    return null
  }
  
  return parsed * 1000 // Convert seconds to milliseconds
}

/**
 * Check if data is stale based on last received time and timeout
 * @param {number|null} lastDataTime - Timestamp when data was last received (Date.now() format)
 * @param {number|null} timeoutMs - Timeout in milliseconds, or null if disabled
 * @param {number} currentTime - Current timestamp (for testability, defaults to Date.now())
 * @returns {boolean} True if data is stale, false otherwise
 */
function isStale (lastDataTime, timeoutMs, currentTime = Date.now()) {
  // Timeout disabled
  if (!timeoutMs) {
    return false
  }
  
  // No data received yet
  if (!lastDataTime) {
    return true
  }
  
  // Check if timeout exceeded
  return (currentTime - lastDataTime) > timeoutMs
}

/**
 * Determine the appropriate status display based on stale state and product info
 * @param {boolean} isDataStale - Whether the data is currently stale
 * @param {string|null} productName - The product name, if known
 * @returns {Object} Status object with fill, shape, and text properties
 */
function getStatusDisplay (isDataStale, productName) {
  if (isDataStale) {
    return { fill: 'yellow', shape: 'ring', text: 'stale data' }
  }
  
  if (productName) {
    return { fill: 'green', shape: 'dot', text: productName }
  }
  
  return { fill: 'green', shape: 'dot', text: 'connected' }
}

module.exports = {
  parseTimeout,
  isStale,
  getStatusDisplay
}
