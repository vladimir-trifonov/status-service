'use strict'

const network = require('./network')
const service = require('./service')

network.createSource().pipe(service({ network }))
