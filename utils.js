'use strict'

module.exports.serialize = (obj) => JSON.stringify(obj)
module.exports.log = (name) => (...args) => console.log.apply(null, [`${name}: [`].concat(args.concat([']'])))
