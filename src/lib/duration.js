/**
 * Duration formatting
 * Pure function for reporting how long something has been going wrong
 */

/**
 * Describe an elapsed time in the largest unit that still reads precisely.
 * "failing for 86412s" is not a thing anyone wants to parse at 3am.
 * @param {number} ms - Elapsed milliseconds
 * @returns {string} Human-readable duration
 */
function describeDuration (ms) {
  const seconds = Math.max(0, Math.round(ms / 1000))

  if (seconds < 120) {
    return `${seconds}s`
  }

  // Hand off before minutes reach three digits: "120m" is worse than "2h".
  if (seconds < 5400) {
    return `${Math.round(seconds / 60)}m`
  }

  return `${(seconds / 3600).toFixed(1)}h`
}

module.exports = { describeDuration }
