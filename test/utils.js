'use strict'

const test = require('tape')
const tk = require('timekeeper')

const { serialize, momentUnix, msToSes, secToMs, toMsg, bufToJSON } = require('../utils')

let buffer

test('should serialize object', (t) => {
  const result = serialize({ x: 1 })
  const expected = '{"x":1}'
  t.equal(result, expected)
  t.end()
})

test('should return timestamp in unix', (t) => {
  const time = new Date()
  tk.freeze(time)

  const result = momentUnix()
  const expected = +(time / 1000).toFixed(0)
  t.equal(result, expected)
  t.end()

  tk.reset()
})

test('should return seconds', (t) => {
  const result = msToSes(5000)
  const expected = 5
  t.equal(result, expected)
  t.end()
})

test('should return ms', (t) => {
  const result = secToMs(5)
  const expected = 5000
  t.equal(result, expected)
  t.end()
})

test('should return buffer', (t) => {
  const result = toMsg({ x: 1 })
  buffer = result
  const expected = '{"x":1}'
  t.ok(result instanceof Buffer)
  t.equal(result.toString(), expected)
  t.end()
})

test('should return JSON', (t) => {
  const result = bufToJSON(buffer)
  const expected = { x: 1 }
  t.deepEqual(result, expected)
  t.end()
})
