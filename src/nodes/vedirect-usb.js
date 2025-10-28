module.exports = function (RED) {
  'use strict'
  const VEDirect = require('../services/vedirect')
  const { SerialPort } = require('serialport')
  const { parseTimeout, isStale, getStatusDisplay } = require('../lib/stale-detector')
  const debug = require('debug')('vedirect:node')

  function VEDirectUSB (config) {
    RED.nodes.createNode(this, config)

    const node = this
    debug('Initializing VEDirectUSB node on port %s', config.port)

    const dataReader = new VEDirect(config.port)
    let accumulatedData = {} // Accumulated data across all frames
    let productName = null
    let dataEventCount = 0
    let lastDataTime = null
    let staleCheckInterval = null

    // Parse timeout configuration
    const timeoutMs = parseTimeout(config.timeout)

    debug('Stale detection timeout: %s ms', timeoutMs)

    // Function to update status based on current state
    function updateStatus () {
      const stale = isStale(lastDataTime, timeoutMs)
      const status = getStatusDisplay(stale, productName)

      if (stale) {
        debug('Data is stale')
      }

      node.status(status)
    }

    // Set up interval to check for stale data
    if (timeoutMs) {
      debug('Starting stale data check interval')
      staleCheckInterval = setInterval(() => {
        updateStatus()
      }, 1000) // Check every second
    }

    dataReader.on('data', (data) => {
      dataEventCount++
      lastDataTime = Date.now()
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

      updateStatus()
    })

    dataReader.on('error', (error) => {
      debug('Error from dataReader: %o', error)
      node.status({ fill: 'red', shape: 'dot', text: error })
      node.warn(error)
    })

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
        node.status({ fill: 'yellow', shape: 'ring', text: 'waiting for data' })
      }
      node.send(msg)
    })

    node.on('close', function () {
      debug('Closing node, clearing interval and closing serial port')
      if (staleCheckInterval) {
        clearInterval(staleCheckInterval)
      }
      dataReader.serial.close()
    })
  }

  RED.nodes.registerType('victron-vedirect-usb', VEDirectUSB)

  RED.httpAdmin.get('/victron/vedirect-ports', (_req, res) => {
    SerialPort.list().then((ports) => {
      res.json(ports)
    }, (err) => {
      RED.log.error(err)
      res.status(500).json({ error: err.message })
    })
  })
}