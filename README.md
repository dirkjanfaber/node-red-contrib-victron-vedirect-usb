This node uses a [VE.Direct USB connection](https://www.victronenergy.com/accessories/ve-direct-to-usb-interface)
to grab the communication on the serial port and translates it into usable data.

A typical use case would be to run Node-RED on a Raspberry Pi and
connect to the VE.Direct port of a Victron Energy device. E.g. a
SmartShunt, BMV, Inverter or MPPT.

# Usage

Once the node gets deployed it keeps on reading and stores the values as they
get read from the serial port. It only outputs on 'inject', so it is needed to
trigger output via an _inject_ node to the node. Typically you would configure
that to repeat on an interval of a few seconds.

# Configuration

Select the port to use from the dropdown. The dropdown is generated on the fly,
so make sure that the USB part of the cable is connected to the system running
Node-RED.

# Output

The output depends on the connected product, but is based on the
[VE.Direct-Protocol-3.23.pdf](https://www.victronenergy.com/upload/documents/VE.Direct-Protocol-3.32.pdf).

The `msg.payload` holds the used VE.Direct label, the units, description and value. E.g.:

```
...
PID: {"value":"0xA389","description":"ProductID","units":""},
V: {"value":7814,"description":"Main or channel 1 (battery) voltage","units":"mV"},
I: {"value":0,"description":"Main or channel 1 battery current","units":"mA"}
...
```

The above example is abbreviated. It typically consists of more labels.

# License

License is _GPL-3.0-or-later_.

# About

The code is based on https://github.com/bencevans/ve.direct of Ben Evans.
