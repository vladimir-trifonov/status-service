'use strict'

module.exports.serialize = (obj) => JSON.stringify(obj)
module.exports.momentUnix = () => +(new Date() / 1000).toFixed(0)
module.exports.log = (name) => (...args) => console.log.apply(null, [`${name}: [`].concat(args.concat([']'])))
module.exports.msToSes = (ms) => ms / 1000
module.exports.secToMs = (sec) => sec * 1000
