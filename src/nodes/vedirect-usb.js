module.exports = function (RED) {
  'use strict'
  const fs = require('fs')
  const path = require('path')
  const VEDirect = require('../services/vedirect')
  const { SerialPort } = require('serialport')
  const { parseTimeout, isStale } = require('../lib/stale-detector')
  const {
    getStatusDisplay,
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    ERROR,
    REASON_CLOSE,
    REASON_STALE,
    REASON_ERROR,
    REASON_OPEN_FAILURE
  } = require('../lib/connection-status')
  const { resolveSerialPort } = require('../lib/port-resolver')
  const { nextDelay, LIVENESS_TIMEOUT_MS, STEADY_MS } = require('../lib/reconnect-policy')
  const { createWarnThrottle } = require('../lib/warn-throttle')
  const { describeDuration } = require('../lib/duration')
  const debug = require('debug')('vedirect:node')

  // How often the supervisor looks at the connection. Frequent enough that the
  // status badge tracks reality, cheap enough to run forever.
  const LIVENESS_CHECK_INTERVAL_MS = 1000

  // How long to wait for in-flight closes before letting Node-RED continue.
  const CLOSE_TIMEOUT_MS = 5000

  // /dev/serial/by-id/... symlinks are maintained by udev on Linux and stay
  // pointing at the same physical device across reboots/replugs, unlike
  // /dev/ttyUSB* device names which can swap around. Where available, attach
  // that stable path to each listed port so it can be offered in the UI.
  function withByIdPaths (ports) {
    const byIdDir = '/dev/serial/by-id'
    let entries

    try {
      entries = fs.readdirSync(byIdDir)
    } catch (err) {
      // Not on Linux, or no by-id symlinks present (e.g. macOS, Windows)
      return ports
    }

    const byIdPathByRealPath = {}
    entries.forEach((entry) => {
      const linkPath = path.join(byIdDir, entry)
      try {
        byIdPathByRealPath[fs.realpathSync(linkPath)] = linkPath
      } catch (err) {
        debug('Skipping broken symlink %s: %o', linkPath, err)
      }
    })

    return ports.map((port) => {
      const byId = byIdPathByRealPath[port.path]
      return byId ? { ...port, byId } : port
    })
  }

  function VEDirectUSB (config) {
    RED.nodes.createNode(this, config)

    const node = this
    debug('Initializing VEDirectUSB node on port %s', config.port)

    let dataReader = null
    let shuttingDown = false
    let accumulatedData = {} // Accumulated data across all frames
    let productName = null
    let dataEventCount = 0
    let lastDataTime = null
    let connectedAt = null
    let livenessInterval = null
    let reconnectTimer = null
    let reconnectAttempts = 0
    let failingSince = null
    let steadySince = null
    let currentPath = config.port

    // One throttle per fault class, so a noisy outage can't swallow the first
    // report of a different problem.
    const CONNECTION_CHANNEL = 'connection'
    const CLOSE_CHANNEL = 'close'
    const RECOVERY_CHANNEL = 'recovery'
    const throttle = createWarnThrottle()
    let connection = {}

    // Readers whose close() is still in flight. Node-RED must not report the
    // node closed while a file descriptor is still held, or the redeploy that
    // follows reopens the same path against a port the kernel has not released.
    const closingReaders = new Set()

    const timeoutMs = parseTimeout(config.timeout)

    // "Is the output fresh enough to send" and "is the link dead" are different
    // questions, so the output timeout only ever lengthens the supervision
    // window. Reusing a short timeout here would tear down a healthy port
    // between two frames.
    const livenessMs = Math.max(timeoutMs || 0, LIVENESS_TIMEOUT_MS)

    debug('Stale detection timeout: %s ms, liveness timeout: %d ms', timeoutMs, livenessMs)

    function updateStatus () {
      node.status(getStatusDisplay({
        ...connection,
        hasData: lastDataTime !== null,
        stale: isStale(lastDataTime, timeoutMs),
        productName
      }))
    }

    function setConnection (state, extra) {
      connection = { state, ...extra }
      updateStatus()
    }

    // One voice per outage: warn immediately, then back off from a minute to an
    // hour. A cable that flaps for a week would otherwise bury every other log
    // line, and the operator can act on the first line just as well as the
    // four-hundredth.
    function warnThrottled (channel, build) {
      throttle.say(channel, (message) => node.warn(message), build)
    }

    function reportFailure (message) {
      if (!failingSince) {
        failingSince = Date.now()
      }

      warnThrottled(CONNECTION_CHANNEL, () => {
        const failingFor = describeDuration(Date.now() - failingSince)
        return `${message} on ${currentPath} (attempt ${reconnectAttempts + 1}, failing for ${failingFor}, retrying)`
      })
    }

    // Close a reader without blocking, but keep the handle so node close can
    // wait for it.
    function disposeReader (reader) {
      if (!reader) {
        return
      }

      // Name the port this reader held, not whichever one the next attempt has
      // since resolved to.
      const heldPath = currentPath

      let settle
      const pending = { heldPath }
      pending.finished = new Promise((resolve) => { settle = resolve })
      closingReaders.add(pending)

      reader.close((err) => {
        if (err) {
          // Not a connection failure, and during shutdown nothing retries.
          warnThrottled(CLOSE_CHANNEL, () => `Failed to close ${heldPath}: ${err.message || err}`)
        } else {
          // A clean teardown ends this run of close trouble, so the next one
          // is reported at once rather than under an hour-wide quiet period.
          throttle.reset(CLOSE_CHANNEL)
        }
        closingReaders.delete(pending)
        settle()
      })
    }

    // Drop the current connection and open a fresh one after a backoff delay.
    // The pipe chain inside a VEDirect cannot be restarted once its serial
    // stream has ended, so recovery always means building a new one.
    function scheduleReconnect (reason) {
      if (shuttingDown || reconnectTimer) {
        return
      }

      const delay = nextDelay(reconnectAttempts)
      reconnectAttempts++

      debug('Reconnecting in %d ms (attempt #%d) after %s', delay, reconnectAttempts, reason)

      // Keep a reported error on screen through the backoff window; it says
      // why we are retrying, which a bare "reconnecting" would throw away.
      if (connection.state !== ERROR) {
        setConnection(RECONNECTING, { reason })
      }

      connectedAt = null
      steadySince = null

      const reader = dataReader
      dataReader = null
      disposeReader(reader)

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    // The driver told us why, so show its words on the badge.
    function connectionErrored (message, reason) {
      reportFailure(message)
      setConnection(ERROR, { error: message })
      scheduleReconnect(reason)
    }

    // The link just went away, with no driver message to show. A lost cable and
    // a silent device are the two commonest field faults, and both used to
    // retry in complete silence.
    function connectionDropped (message, reason) {
      reportFailure(message)
      scheduleReconnect(reason)
    }

    function connect () {
      if (shuttingDown) {
        return
      }

      setConnection(CONNECTING)

      // Resolve the port to open, preferring the USB serial number (if configured)
      // over the raw path, since Linux does not guarantee ttyUSB* names stay
      // attached to the same physical device across reboots/replugs. Re-resolved
      // on every attempt: after a replug the device may be on a different path.
      SerialPort.list()
        .then((ports) => resolveSerialPort(config.port, config.serialNumber, ports))
        .catch((err) => {
          debug('Failed to list serial ports, falling back to configured path: %o', err)
          return config.port
        })
        .then((resolvedPath) => {
          if (shuttingDown) {
            return
          }

          if (resolvedPath !== config.port) {
            debug('Resolved serial number %s to %s (configured path was %s)', config.serialNumber, resolvedPath, config.port)
          }

          currentPath = resolvedPath

          const reader = new VEDirect(resolvedPath)
          dataReader = reader

          reader.on('open', () => {
            debug('Serial port open on %s', resolvedPath)
            connectedAt = Date.now()
            setConnection(CONNECTED)
          })

          reader.on('data', (data) => {
            dataEventCount++
            lastDataTime = Date.now()

            // A frame arrived, so this connection works: forget past failures
            // and start the next backoff from scratch.
            if (reconnectAttempts > 0) {
              // One frame is not recovery. A cable that flaps every few
              // seconds delivers a frame per cycle, and treating that as
              // recovered would clear the throttle on every flap - the exact
              // log storm the throttle exists to prevent. Announce it under
              // the same widening interval, and only clear the connection
              // throttle once the link has held (see the liveness tick).
              const attempts = reconnectAttempts
              const outage = describeDuration(Date.now() - failingSince)

              // node.warn, not node.log: only warn and error reach the editor's
              // debug sidebar, so a recovery logged any lower leaves the
              // operator staring at a failure that reads as still open.
              warnThrottled(RECOVERY_CHANNEL,
                () => `Receiving data again on ${currentPath} after ${attempts} attempt(s) over ${outage}`)

              reconnectAttempts = 0
              failingSince = null
              steadySince = Date.now()
            }

            debug('Received data event #%d at %d', dataEventCount, lastDataTime)
            debug('Frame has %d fields', Object.keys(data).length)

            // Merge new data into accumulated data (overwrites existing fields)
            accumulatedData = { ...accumulatedData, ...data }

            debug('Accumulated data now has %d total fields', Object.keys(accumulatedData).length)

            // Store and display product name when we first see it
            if (data.PID && data.PID.product) {
              productName = data.PID.product
              debug('Product identified: %s', productName)
            }

            setConnection(CONNECTED)
          })

          reader.on('error', (error) => {
            debug('Error from dataReader: %o', error)
            connectionErrored(error.message || String(error), REASON_ERROR)
          })

          // A disconnect reaches us as 'close', never as 'error'.
          reader.on('close', (info) => {
            debug('Connection closed (disconnected: %s)', info && info.disconnected)
            connectionDropped('Lost the serial connection', REASON_CLOSE)
          })
        })
        .catch((err) => {
          debug('Failed to open serial port: %o', err)
          connectionErrored(err.message || String(err), REASON_OPEN_FAILURE)
        })
    }

    // Watch for a connection that is open but silent. A VE.Direct device can
    // stop transmitting while the file descriptor stays valid, which produces
    // no serial event at all, so silence is the only symptom to act on. The
    // same tick repaints the badge, which is why it runs even when stale
    // detection is switched off.
    livenessInterval = setInterval(() => {
      // Measure silence from whichever came last, the newest frame or the
      // moment this connection opened. Anchoring on lastDataTime alone would
      // carry a timestamp from before the disconnect into the fresh
      // connection and tear it down a second after opening.
      const lastActivity = Math.max(lastDataTime || 0, connectedAt || 0) || null

      if (connection.state === CONNECTED && isStale(lastActivity, livenessMs)) {
        connectionDropped(`No data for ${describeDuration(livenessMs)}`, REASON_STALE)
        return
      }

      // The link has held long enough to call it recovered, so the next outage
      // gets reported at once instead of inheriting this one's quiet period.
      // Anchored on the newest frame, not the clock: a device that delivers one
      // frame and then dies would otherwise age into "recovered" while silent,
      // and a flapping cable would clear the throttle on every cycle.
      if (steadySince && lastDataTime - steadySince >= STEADY_MS) {
        steadySince = null
        throttle.reset(CONNECTION_CHANNEL)
        throttle.reset(RECOVERY_CHANNEL)
      }

      updateStatus()
    }, LIVENESS_CHECK_INTERVAL_MS)

    connect()

    let inputCount = 0

    node.on('input', function (msg) {
      inputCount++
      debug('Input triggered #%d', inputCount)

      // Check if data is stale
      if (isStale(lastDataTime, timeoutMs)) {
        debug('Data is stale, not sending output')
        updateStatus()
        return // Don't send anything
      }

      // Output the accumulated data containing all fields seen so far
      if (Object.keys(accumulatedData).length > 0) {
        debug('Sending accumulated data with %d fields', Object.keys(accumulatedData).length)
        msg.payload = accumulatedData
      } else {
        debug('No data available yet')
        msg.payload = {}
      }

      updateStatus()
      node.send(msg)
    })

    node.on('close', function (done) {
      debug('Closing node, clearing timers and closing serial port')
      shuttingDown = true

      clearInterval(livenessInterval)
      livenessInterval = null

      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      const reader = dataReader
      dataReader = null
      disposeReader(reader)

      // Wait on any reader a reconnect was already closing - but not forever.
      // A driver call that neither resolves nor rejects (a wedged ioctl on a
      // device yanked mid-transfer) would otherwise block the redeploy.
      let closeTimer = null
      const closed = Promise.all([...closingReaders].map((pending) => pending.finished))
      const gaveUp = new Promise((resolve) => {
        closeTimer = setTimeout(() => resolve(true), CLOSE_TIMEOUT_MS)

        // Never hold the process open on account of the deadline itself.
        if (closeTimer.unref) {
          closeTimer.unref()
        }
      })

      Promise.race([closed.then(() => false), gaveUp]).then((timedOut) => {
        clearTimeout(closeTimer)

        // Name what is actually stuck, which is whatever has not settled. The
        // set can empty on the deadline itself - the driver reports its close
        // on nextTick, which runs before this continuation - and then nothing
        // is stuck and there is nothing to report.
        const stuck = [...closingReaders].map((pending) => pending.heldPath)

        if (timedOut && stuck.length > 0) {
          node.warn(`Gave up waiting for ${stuck.join(', ')} to close`)
        }

        done()
      })
    })
  }

  RED.nodes.registerType('victron-vedirect-usb', VEDirectUSB)

  RED.httpAdmin.get('/victron/vedirect-ports', (_req, res) => {
    SerialPort.list().then((ports) => {
      res.json(withByIdPaths(ports))
    }, (err) => {
      RED.log.error(err)
      res.status(500).json({ error: err.message })
    })
  })
}
