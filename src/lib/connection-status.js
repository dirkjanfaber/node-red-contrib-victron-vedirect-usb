/**
 * Connection state and status rendering
 * Pure functions mapping the supervisor's view of the serial connection onto
 * the status badge Node-RED shows under the node
 */

const CONNECTING = 'connecting'
const CONNECTED = 'connected'
const RECONNECTING = 'reconnecting'
const ERROR = 'error'

// Why the supervisor gave up on the previous connection.
const REASON_CLOSE = 'close'
const REASON_STALE = 'stale data'
const REASON_ERROR = 'error'
const REASON_OPEN_FAILURE = 'open failure'

// Only the reasons that reach the badge; an error and a failed open show the
// driver's own message instead, which says more than any wording here could.
// The operator needs "replug the cable" to look different from "the device
// went quiet", which a bare "reconnecting" does not tell them.
const REASON_TEXT = {
  [REASON_CLOSE]: 'disconnected',
  [REASON_STALE]: 'no data'
}

/**
 * Render the status badge for the current connection.
 *
 * Connection state outranks data state: while the port is down, "stale data"
 * is a symptom rather than the thing the operator needs to see, and the
 * periodic liveness check must never paint over a connection error.
 * @param {Object} status - Current view of the connection
 * @param {string} status.state - One of 'connecting', 'connected', 'reconnecting', 'error'
 * @param {string} [status.error] - Error message, when state is 'error'
 * @param {string} [status.reason] - Why we are reconnecting, when state is 'reconnecting'
 * @param {boolean} [status.hasData] - Whether any frame has ever been received
 * @param {boolean} [status.stale] - Whether the received data is now stale
 * @param {string} [status.productName] - The product name, if known
 * @returns {Object} Status object with fill, shape, and text properties
 */
function getStatusDisplay (status) {
  const { state, error, reason, hasData, stale, productName } = status || {}

  // Retries never stop, so an error is never the last word. Saying so keeps a
  // red badge from reading as terminal.
  if (state === ERROR) {
    // Marker first: a driver message can be long enough that the badge clips,
    // and the half saying we haven't given up is the half worth keeping.
    return { fill: 'red', shape: 'dot', text: `retrying: ${error || 'error'}` }
  }

  if (state === CONNECTING) {
    return { fill: 'blue', shape: 'ring', text: 'connecting' }
  }

  if (state === RECONNECTING) {
    const why = REASON_TEXT[reason]
    return { fill: 'yellow', shape: 'ring', text: why ? `reconnecting (${why})` : 'reconnecting' }
  }

  // Anything we don't recognise must not claim the connection is healthy.
  if (state !== CONNECTED) {
    return { fill: 'grey', shape: 'ring', text: 'unknown' }
  }

  if (!hasData) {
    return { fill: 'yellow', shape: 'ring', text: 'waiting for data' }
  }

  if (stale) {
    return { fill: 'yellow', shape: 'ring', text: 'stale data' }
  }

  return { fill: 'green', shape: 'dot', text: productName || 'connected' }
}

module.exports = {
  getStatusDisplay,
  CONNECTING,
  CONNECTED,
  RECONNECTING,
  ERROR,
  REASON_CLOSE,
  REASON_STALE,
  REASON_ERROR,
  REASON_OPEN_FAILURE
}
