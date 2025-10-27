module.exports = function (RED) {
  'use strict'
  const VEDirect = require('../services/vedirect')
  const { SerialPort } = require('serialport')

  function VEDirectUSB (config) {
    RED.nodes.createNode(this, config)

    const node = this
    const dataReader = new VEDirect(config.port)
    let mergedData = {}
    let lastUpdateTime = null
    const dataStaleInterval = 5000 // 5 secs

    dataReader.on('data', (data) => {
      // Merge in the current received data and the timestamp
      Object.assign(mergedData, data)
      lastUpdateTime = Date.now()

      if (data.PID) {
        node.status({ fill: 'green', shape: 'dot', text: data.PID.product || '' })
      }
    })

    dataReader.on('error', (error) => {
      node.status({ fill: 'red', shape: 'dot', text: error })
      node.warn(error)
    })

    node.on('input', function (msg) {
      const currentTime = Date.now()
      if ((currentTime - lastUpdateTime) > dataStaleInterval) {
        // Reset mergedData if data is stale
        mergedData = {}
        node.status({ fill: 'yellow', shape: 'ring', text: 'data stale or unavailable' })
      }
      msg.payload = mergedData
      node.send(msg)
    })

    node.on('close', function () {
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
