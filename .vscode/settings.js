module.exports = {
    uiPort: 1880,
    flowFile: 'flows.json',
    userDir: process.env.HOME + '/.node-red',
    functionGlobalContext: {},
    debugMaxLength: 1000,
    nodesDir: [process.env.HOME + '/git/node-red-contrib-victron-vedirect-usb/src/nodes',
        process.env.HOME + '/git/node-red-contrib-victron/src/nodes',
        process.env.HOME + '/git/victron-vrm-api/src/nodes'
    ],
    verbose: true,
    logging: {
        console: {
            level: "debug",
            metrics: false,
            audit: false
        }
    },
    "files.trimTrailingWhitespace": true,
    "files.insertFinalNewline": true,
    "files.trimFinalNewlines": true
};
