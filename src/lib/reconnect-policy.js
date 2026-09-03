/**
 * Reconnect policy
 * When to give up on a connection, and how long to wait before the next try
 */

// How long a port may stay open and silent before we treat the link as dead.
// A healthy VE.Direct device sends a frame about every second, so a minute of
// silence means the link is gone even though the file descriptor still looks
// fine. Used as a floor, never as a ceiling: it answers "is the link dead",
// which is a different question from the configured output-staleness timeout.
const LIVENESS_TIMEOUT_MS = 60000

// How long to stay quiet between warnings about an ongoing outage. Dedup on
// the message text alone does not work: a dead cable alternates between "lost
// the connection" and "cannot open", so every retry looks new. Doubling from a
// minute to an hour keeps a month-long outage to a readable trail.
const BASE_WARN_GAP_MS = 60000
const MAX_WARN_GAP_MS = 3600000

// How long a connection must keep delivering before an outage counts as over
// and the warning throttle resets. It has to outlast a flap cycle, and there is
// no point resetting sooner than the throttle's own shortest quiet period.
const STEADY_MS = BASE_WARN_GAP_MS

const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000
const JITTER_RATIO = 0.2

/**
 * Delay before the given reconnection attempt.
 * Exponential backoff, capped, with jitter so several nodes losing the same
 * USB hub don't all retry in lockstep.
 * @param {number} attempt - Number of consecutive failed attempts so far (0 for the first retry)
 * @param {function} random - Source of randomness in [0, 1) (for testability, defaults to Math.random)
 * @returns {number} Delay in milliseconds
 */
function nextDelay (attempt, random = Math.random) {
  const exponent = Math.max(0, Math.floor(attempt) || 0)
  const base = Math.min(BASE_DELAY_MS * Math.pow(2, exponent), MAX_DELAY_MS)
  const jitter = base * JITTER_RATIO * (random() * 2 - 1)

  // Clamp after jitter, not before: jittering the cap would overshoot the
  // maximum delay this module documents.
  return Math.min(MAX_DELAY_MS, Math.round(base + jitter))
}

/**
 * Quiet period before warning again about an outage that is still going.
 * @param {number} warnCount - Warnings already emitted for this outage
 * @returns {number} Gap in milliseconds
 */
function nextWarnGap (warnCount) {
  const exponent = Math.max(0, Math.floor(warnCount) || 0)

  return Math.min(BASE_WARN_GAP_MS * Math.pow(2, exponent), MAX_WARN_GAP_MS)
}

module.exports = {
  nextDelay,
  nextWarnGap,
  BASE_WARN_GAP_MS,
  MAX_WARN_GAP_MS,
  STEADY_MS,
  LIVENESS_TIMEOUT_MS,
  BASE_DELAY_MS,
  MAX_DELAY_MS
}
