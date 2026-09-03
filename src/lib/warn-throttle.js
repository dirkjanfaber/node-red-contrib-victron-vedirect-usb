/**
 * Warning throttle
 * Keeps one ongoing problem to a readable trail instead of one line per retry
 */

const { nextWarnGap } = require('./reconnect-policy')

/**
 * Create a throttle with independent channels, so a noisy outage cannot
 * swallow the first report of a different problem.
 * @param {function} now - Clock (for testability, defaults to Date.now)
 * @returns {{say: function, reset: function}} Throttle
 */
function createWarnThrottle (now = Date.now) {
  const channels = {}

  return {
    /**
     * Emit a message unless this channel spoke too recently.
     * @param {string} channel - Fault class this message belongs to
     * @param {function} emit - Called with the built message when not throttled
     * @param {function} build - Builds the message; only called when emitting
     * @returns {boolean} Whether the message was emitted
     */
    say (channel, emit, build) {
      const at = now()
      const state = channels[channel] || (channels[channel] = { at: null, count: 0 })

      if (state.at !== null && at - state.at < nextWarnGap(state.count - 1)) {
        return false
      }

      state.at = at
      state.count++
      emit(build())

      return true
    },

    /**
     * Forget a channel's history, so its next message is emitted at once.
     * @param {string} channel - Fault class to reset
     */
    reset (channel) {
      delete channels[channel]
    }
  }
}

module.exports = { createWarnThrottle }
