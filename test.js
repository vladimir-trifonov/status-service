
'use strict'

const test = require('tape')
const sinon = require('sinon')
const tk = require('timekeeper')
const pull = require('pull-stream')

const { momentUnix } = require('./utils')
const service = require('./service')

const createTestNetwork = (read) => {
  return {
    createSource: (end, cb) => {
      if (end) return cb(end)
      read(cb)
    }
  }
}

test('not returns payment status when there are no payments registered', (t) => {
  const respond = () => t.fail()
  const messages = [{
    type: 'health',
    created: momentUnix(),
    party: [0]
  }]

  const mockedNetwork = createTestNetwork(function (cb) {
    if (messages.length) return cb(null, messages.shift())
    else cb(true) // eslint-disable-line standard/no-callback-literal

    // Assert
    setTimeout(() => {
      t.end()
    }, 500)
  })

  pull(mockedNetwork.createSource, service(respond))
})

test('not returns payment status when there is no reaction time being calculated', (t) => {
  const respond = () => t.fail()
  const messages = [{
    type: 'payment',
    created: momentUnix(),
    parties: [0],
    success: true
  }, {
    type: 'health',
    created: momentUnix(),
    party: [0]
  }]

  const mockedNetwork = createTestNetwork(function (cb) {
    if (messages.length) return cb(null, messages.shift())
    else cb(true) // eslint-disable-line standard/no-callback-literal

    // Assert
    t.end()
  })

  pull(mockedNetwork.createSource, service(respond))
})

test('returns a degraded status when there have been no successful payments', (t) => {
  const respond = sinon.stub()
  const messages = [...Array(10).keys()].map(() => ({
    type: 'payment',
    created: momentUnix(),
    parties: [0],
    success: false
  }))
  messages.push({
    type: 'health',
    created: momentUnix(),
    party: [0]
  })

  const mockedNetwork = createTestNetwork(function (cb) {
    if (messages.length) return cb(null, messages.shift())
    else cb(true) // eslint-disable-line standard/no-callback-literal

    // Assert
    t.equal(respond.callCount, 1)
    t.ok(!!respond.firstCall.args)
    t.equal(respond.firstCall.args.length, 2)

    const res = respond.firstCall.args[0]
    const src = respond.firstCall.args[1]

    t.equal(res.type, 'health')
    t.ok(!!res.party.length)
    t.equal(res.party[0], 0)

    t.equal(src.type, 'health-status')
    t.ok(!!src.party.length)
    t.equal(src.party[0], 0)
    t.equal(src.healthy, false)

    t.end()
  })

  pull(mockedNetwork.createSource, service(respond))
})

test('returns healthy payment status set to true', (t) => {
  const respond = sinon.stub()
  const messages = [...Array(10).keys()].map(() => ({
    type: 'payment',
    created: momentUnix(),
    parties: [0],
    success: true
  }))
  messages.push({
    type: 'health',
    created: momentUnix(),
    party: [0]
  })

  const mockedNetwork = createTestNetwork(function (cb) {
    if (messages.length) return cb(null, messages.shift())
    else cb(true) // eslint-disable-line standard/no-callback-literal

    // Assert
    t.equal(respond.callCount, 1)
    t.ok(!!respond.firstCall.args)
    t.equal(respond.firstCall.args.length, 2)

    const res = respond.firstCall.args[0]
    const src = respond.firstCall.args[1]

    t.equal(res.type, 'health')
    t.ok(!!res.party.length)
    t.equal(res.party[0], 0)

    t.equal(src.type, 'health-status')
    t.ok(!!src.party.length)
    t.equal(src.party[0], 0)
    t.equal(src.healthy, true)

    t.end()
  })

  pull(mockedNetwork.createSource, service(respond))
})

test('returns healthy payment status set to false', (t) => {
  const respond = sinon.stub()
  const messages = [...Array(10).keys()].map(() => ({
    type: 'payment',
    created: momentUnix(),
    parties: [0],
    success: true
  }))
  let count = 0
  let time

  const mockedNetwork = createTestNetwork(function (cb) {
    if (messages.length) {
      count++
      return cb(null, messages.shift())
    } else if (count === 10) {
      count++
      time = new Date((momentUnix() + 2) * 1000) // + 2 sec
      tk.freeze(time)

      cb(null, {
        type: 'payment',
        created: momentUnix(),
        parties: [0],
        success: true
      })
      tk.reset(time)
    } else if (count === 11) {
      count++
      // Go ahead of time so the payment  service
      // shouldn't have successful payments for the
      // current party during the last reaction time
      time = new Date((momentUnix() + 6) * 1000) // + 6 sec
      tk.freeze(time)

      cb(null, {
        type: 'health',
        created: momentUnix(),
        party: [0]
      })
      tk.reset(time)
    } else {
      cb(true) // eslint-disable-line standard/no-callback-literal

      // Assert
      t.equal(respond.callCount, 1)
      t.ok(!!respond.firstCall.args)
      t.equal(respond.firstCall.args.length, 2)

      const res = respond.firstCall.args[0]
      const src = respond.firstCall.args[1]

      t.equal(res.type, 'health')
      t.ok(!!res.party.length)
      t.equal(res.party[0], 0)

      t.equal(src.type, 'health-status')
      t.ok(!!src.party.length)
      t.equal(src.party[0], 0)
      t.equal(src.healthy, false)

      t.end()
    }
  })

  pull(mockedNetwork.createSource, service(respond))
})
