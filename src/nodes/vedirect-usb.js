module.exports = function (RED) {
  'use strict'
  const VEDirect = require('../services/vedirect')
  const { SerialPort } = require('serialport')

  function VEDirectUSB (config) {
    RED.nodes.createNode(this, config)

    const node = this
    const dataReader = new VEDirect(config.port)

    dataReader.on('data', (data) => {
      const nodeContext = this.context()
      const msg = {
        topic: 'VE.direct'
      }

      if (data.H1) {
        nodeContext.set('d1', data)
        msg.payload = Object.assign({}, data, nodeContext.get('d2'))
      } else {
        nodeContext.set('d2', data)
        msg.payload = Object.assign({}, data, nodeContext.get('d1'))
      }
      if (msg.payload.PID) {
        node.status({ fill: 'green', shape: 'dot', text: msg.payload.PID.product || '' })
      }
    })

    dataReader.on('error', (error) => {
      node.status({ fill: 'red', shape: 'dot', text: error })
      node.warn(error)
    })

    node.on('input', function (msg) {
      const nodeContext = this.context()
      msg.payload = Object.assign({}, nodeContext.get('d1'), nodeContext.get('d2'))
      node.send(msg)
    })

    node.on('close', function () {
      dataReader.serial.close()
    })
  }

  RED.nodes.registerType('victron-vedirect-usb', VEDirectUSB)

  RED.httpNode.get('/victron/vedirect-ports', (req, res) => {
    const vedirectports = []

    function list (ports) {
      res.setHeader('Content-Type', 'application/json')
      ports.forEach((port) => {
        vedirectports.push(port)
      })
      return res.send(vedirectports)
    }

    SerialPort.list().then(list, err => {
      console.log(err)
    })
  })
}
