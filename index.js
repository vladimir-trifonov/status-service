'use strict'

const pull = require('pull-stream')

const network = require('./network')
const service = require('./service')

pull(network.createSource, service(network.respond))
