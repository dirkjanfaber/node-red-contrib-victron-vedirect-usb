'use strict'
module.exports = function (RED) {
  const VEDirect = require('../services/vedirect')
  const { SerialPort } = require('serialport')

  function VEDirectUSB (config) {
    RED.nodes.createNode(this, config)

    const node = this
    const dataReader = new VEDirect(config.port)
    let lastData = null
    let lastUpdateTime = null
    const dataStaleInterval = 5000 // 5 secs

    dataReader.on('data', (data) => {
      // Update the last received data and the timestamp
      lastData = data
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
      if (lastData && (currentTime - lastUpdateTime) < dataStaleInterval) {
        msg.payload = lastData
      } else {
        msg.payload = {}
        node.status({ fill: 'yellow', shape: 'ring', text: 'data stale or unavailable' })
      }
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
