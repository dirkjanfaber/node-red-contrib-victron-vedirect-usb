module.exports = function (RED) {
  'use strict'
  const VEDirect = require('../services/vedirect')
  const { SerialPort } = require('serialport')
  const debug = require('debug')('vedirect:node')

  function VEDirectUSB (config) {
    RED.nodes.createNode(this, config)

    const node = this
    debug('Initializing VEDirectUSB node on port %s', config.port)

    const dataReader = new VEDirect(config.port)
    let lastData = null
    let productName = null
    let dataEventCount = 0

    dataReader.on('data', (data) => {
      dataEventCount++
      debug('Received data event #%d', dataEventCount)

      // Update the last received data
      lastData = data

      debug('Data has %d fields', Object.keys(data).length)

      // Store and display product name when we first see it
      if (data.PID && data.PID.product) {
        productName = data.PID.product
        debug('Product identified: %s', productName)
        node.status({ fill: 'green', shape: 'dot', text: productName })
      } else if (productName) {
        // Keep showing the product name even if PID isn't in this frame
        debug('Keeping previous product name: %s', productName)
        node.status({ fill: 'green', shape: 'dot', text: productName })
      } else {
        // No product name yet
        debug('No product name yet, showing generic status')
        node.status({ fill: 'green', shape: 'dot', text: 'connected' })
      }
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

      // Simply output the last received data, no staleness check
      if (lastData) {
        debug('Sending data with %d fields', Object.keys(lastData).length)
        msg.payload = lastData
      } else {
        debug('No data available yet')
        msg.payload = {}
        node.status({ fill: 'yellow', shape: 'ring', text: 'waiting for data' })
      }
      node.send(msg)
    })

    node.on('close', function () {
      debug('Closing node, closing serial port')
      dataReader.serial.close()
    })
  }

  RED.nodes.registerType('victron-vedirect-usb', VEDirectUSB)

  RED.httpNode.get('/victron/vedirect-ports', (req, res) => {
    SerialPort.list().then((ports) => {
      res.setHeader('Content-Type', 'application/json')
      res.send(ports)
    }, (err) => {
      console.log(err)
      res.status(500).send(err)
    })
  })
}