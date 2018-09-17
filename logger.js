'use strict'

module.exports = (name) => (...args) => console.log.apply(null, [`${name}: [`].concat(args.concat([']'])))
