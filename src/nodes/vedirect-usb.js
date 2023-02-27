module.exports = function (RED) {
  'use strict'
  const VEDirect = require('../services/vedirect')
  const bindings = require('@serialport/bindings')

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
    })

    dataReader.on('error', (error) => {
      console.error(error)
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
    function list (ports) {
      res.setHeader('Content-Type', 'application/json')
      return res.send(ports)
    }

    bindings.list().then(list, err => {
      console.log(err)
      process.exit(1)
    })
  })
}
