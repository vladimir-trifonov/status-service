'use strict'

const test = require('tape')

let { parties: createPartiesDb } = require('../db')

test('should return object', (t) => {
  const partiesDb = createPartiesDb()

  const result = partiesDb.get()
  t.ok(typeof result === 'object')
  t.end()
})

test('should update object', (t) => {
  const partiesDb = createPartiesDb()
  partiesDb.set(1, { x: 1 })

  const result = partiesDb.get(1)
  const expected = { x: 1 }
  t.deepEqual(result, expected)
  t.end()
})
