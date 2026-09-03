# node-red-contrib-victron-vedirect-usb

This node uses a [VE.Direct USB connection](https://www.victronenergy.com/accessories/ve-direct-to-usb-interface)
to grab the communication on the serial port and translates it into usable data.

![Example flow](img/example-flow.png)

A typical use case would be to run Node-RED on a Raspberry Pi and
connect to the VE.Direct port of a Victron Energy device. E.g. a
SmartShunt, BMV, Inverter or MPPT.

## Usage

Once the node gets deployed it keeps on reading and stores the values as they
get read from the serial port. It only outputs on 'inject', so it is needed to
trigger output via an _inject_ node to the node. Typically you would configure
that to repeat on an interval of a few seconds.

Note that, when using this from a GX device, it requires you to disable `serial-starter`
from using the VE.Direct usb cable. The way to accomplish this is described
[here](https://github.com/victronenergy/venus/wiki/howto-add-a-driver-to-Venus#howto-make-serial-starter-ignore-certain-usb-types).

## Configuration

Select the port to use from the dropdown. The dropdown is generated on the fly,
so make sure that the USB part of the cable is connected to the system running
Node-RED.

Note that there is a filter in place to first show cables that have the manufacturer
set to _Victron Energy BV_. This is there, because if the node tries to connect to
a non-functional port, it might crash Node-RED. This does not happen if it connects
to a functional port.

But if you know what you are doing you can also select a non-tested device.

### Timeout

Configure the stale data detection timeout in seconds (default: 10 seconds).
If no data is received within this time, the node will stop outputting data
and show a warning status. Leave the field empty to disable stale detection.

## Output

The output depends on the connected product, but is based on the
[VE.Direct-Protocol-3.34.pdf](https://www.victronenergy.com/upload/documents/VE.Direct-Protocol-3.34.pdf).

The `msg.payload` holds the used VE.Direct label, the units, description and value. E.g.:

```
...
PID: {"value":"0xA389","description":"ProductID","units":"","product":"SmartShunt 500A/50mV"},
V: {"value":7814,"description":"Main or channel 1 (battery) voltage","units":"mV"},
I: {"value":0,"description":"Main or channel 1 battery current","units":"mA"}
...
```

The above example is abbreviated. It typically consists of more labels.

## Reconnecting

The node supervises its serial connection and reopens it by itself, so a
disconnected or silent cable no longer needs a Node-RED restart to recover. It
reconnects when:

- the device is unplugged or the driver resets the port
- the port cannot be opened, or opening fails with an error
- the port stays open but sends nothing (see the window below)

Retries back off exponentially from about 1 second up to 30 seconds, and the port is
re-resolved on every attempt, so a cable that comes back on a different
`/dev/ttyUSB*` name is still found. The backoff resets as soon as a frame
arrives. An ongoing outage is logged once, then again on a widening interval
from one minute out to one hour, so a week of flapping stays readable. Each
line names the port, the attempt count and how long the outage has lasted, and
a recovery line records the return. That interval only resets once the link has
delivered data steadily for a minute, so a cable that flaps every few seconds
stays under one outage rather than opening a fresh one each cycle.

Fields collected before a disconnect are kept, so a first frame that carries
only part of the record does not lose the rest. They are held back while the
data is stale, but with stale detection disabled an input can still emit fields
from before the outage. If a `/dev/ttyUSB*` path might end up pointing at a
different device, select the port so the serial number is stored with it.

Supervision does not depend on the timeout setting, and retries never stop. The
node treats a port as dead after 60 seconds of silence, or after the configured
timeout if that is longer — the timeout only ever lengthens the window, since
"is this reading fresh enough to send" and "is this link dead" are different
questions.

## Status

| Status | Meaning |
| --- | --- |
| Blue ring, "connecting" | Opening the serial port |
| Green dot, product name | Connected and receiving data |
| Yellow ring, "waiting for data" | Connected, no frame received yet |
| Yellow ring, "stale data" | Connected, but no data within the timeout |
| Yellow ring, "reconnecting (disconnected)" | The cable or port went away; waiting to retry |
| Yellow ring, "reconnecting (no data)" | The port is open but the device went silent; waiting to retry |
| Red dot, `retrying: <message>` | The port could not be opened or reported an error |
| Grey ring, "unknown" | Should not happen; the connection state was not recognised |

## Development

### Project Structure

```
src/
├── lib/              # Pure functions and utilities (unit tested)
│   ├── checksum.js
│   ├── products.js
│   ├── field-definitions.js
│   ├── value-parser.js
│   ├── connection-status.js
│   ├── duration.js
│   ├── port-resolver.js
│   ├── reconnect-policy.js
│   ├── stale-detector.js
│   └── warn-throttle.js
├── services/         # Business logic and stream handlers
│   ├── parser.js
│   └── vedirect.js
└── nodes/           # Node-RED node implementations
    └── vedirect-usb.js

test/
├── unit/            # Unit tests
│   ├── lib/
│   ├── nodes/
│   └── services/
└── fixtures/        # Test data and fixtures
```

### Testing

This project uses Jest for unit testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Coverage

Test coverage reports are generated in the `coverage/` directory after running `npm run test:coverage`.

Target coverage goals:
- **lib/**: 100% (pure functions should be fully testable)
- **services/**: 80%+ (core business logic)
- **nodes/**: The supervisor is covered by driving the node against a stubbed
  Node-RED runtime and a stubbed serial connection (`test/unit/nodes/`)

## License

License is _GPL-3.0-or-later_.

## About

The code is based on https://github.com/bencevans/ve.direct of Ben Evans.

Refactored for better maintainability with:
- Extracted pure functions for easy testing
- Comprehensive unit test coverage with Jest
- Modular architecture separating concerns
