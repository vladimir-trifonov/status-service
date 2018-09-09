'use strict'

const test = require('tape')
const Readable = require('stream').Readable
const sinon = require('sinon')
const tk = require('timekeeper')
const { momentUnix, toMsg, bufToJSON } = require('../utils')

const service = require('..//service')

const createTestNetwork = (read) => {
  return {
    createSource: () => {
      const mockedStream = new Readable({ objectMode: true })
      mockedStream._read = read.bind(mockedStream)
      return mockedStream
    }
  }
}

test('should not return payment status', (t) => {
  let active = false
  const respond = sinon.stub()

  const mockedNetwork = createTestNetwork(function (size) {
    if (active) return
    active = true

    this.push(toMsg({
      type: 'health',
      created: momentUnix(),
      party: [0]
    }))
    this.push(null)

    // Assert
    setTimeout(() => {
      t.equal(respond.callCount, 0)
      t.end()
    }, 500)
  })

  service({ stream: mockedNetwork, network: { respond } })
})

test('should return payment status', (t) => {
  let active = false
  const respond = sinon.stub()

  const mockedNetwork = createTestNetwork(function (size) {
    if (active) return
    active = true

    this.push(toMsg({
      type: 'payment',
      created: momentUnix(),
      parties: [0],
      success: 1
    }))
    this.push(toMsg({
      type: 'health',
      created: momentUnix(),
      party: [0]
    }))
    this.push(null)

    // Assert
    setTimeout(() => {
      t.equal(respond.callCount, 1)
      t.ok(!!respond.firstCall.args)
      t.equal(respond.firstCall.args.length, 2)

      const res = bufToJSON(respond.firstCall.args[0])
      const src = bufToJSON(respond.firstCall.args[1])

      t.equal(res.type, 'health')
      t.ok(!!res.party.length)
      t.equal(res.party[0], 0)

      t.equal(src.type, 'healthy')
      t.ok(!!src.party.length)
      t.equal(src.party[0], 0)
      t.equal(src.status, 1)

      t.end()
    }, 500)
  })

  service({ stream: mockedNetwork, network: { respond } })
})

test('should return payment status 0', (t) => {
  let active = false
  const respond = sinon.stub()

  const mockedNetwork = createTestNetwork(function (size) {
    if (active) return
    active = true;

    [...Array(10).keys()].forEach(() => {
      this.push(toMsg({
        type: 'payment',
        created: momentUnix(),
        parties: [0],
        success: 0
      }))
    })
    this.push(toMsg({
      type: 'health',
      created: momentUnix(),
      party: [0]
    }))
    this.push(null)

    // Assert
    setTimeout(() => {
      t.equal(respond.callCount, 1)
      t.ok(!!respond.firstCall.args)
      t.equal(respond.firstCall.args.length, 2)

      const res = bufToJSON(respond.firstCall.args[0])
      const src = bufToJSON(respond.firstCall.args[1])

      t.equal(res.type, 'health')
      t.ok(!!res.party.length)
      t.equal(res.party[0], 0)

      t.equal(src.type, 'healthy')
      t.ok(!!src.party.length)
      t.equal(src.party[0], 0)
      t.equal(src.status, 0)

      t.end()
    }, 500)
  })

  service({ stream: mockedNetwork, network: { respond } })
})

test('should return payment status 1', (t) => {
  let active = false
  const respond = sinon.stub()

  const mockedNetwork = createTestNetwork(function (size) {
    if (active) return
    active = true;

    [...Array(10).keys()].forEach(() => {
      this.push(toMsg({
        type: 'payment',
        created: momentUnix(),
        parties: [0],
        success: 1
      }))
    })
    this.push(toMsg({
      type: 'health',
      created: momentUnix(),
      party: [0]
    }))
    this.push(null)

    // Assert
    setTimeout(() => {
      t.equal(respond.callCount, 1)
      t.ok(!!respond.firstCall.args)
      t.equal(respond.firstCall.args.length, 2)

      const res = bufToJSON(respond.firstCall.args[0])
      const src = bufToJSON(respond.firstCall.args[1])

      t.equal(res.type, 'health')
      t.ok(!!res.party.length)
      t.equal(res.party[0], 0)

      t.equal(src.type, 'healthy')
      t.ok(!!src.party.length)
      t.equal(src.party[0], 0)
      t.equal(src.status, 1)

      t.end()
    }, 500)
  })

  service({ stream: mockedNetwork, network: { respond } })
})

test('should return payment status 0', (t) => {
  let active = false
  const respond = sinon.stub()

  const mockedNetwork = createTestNetwork(function (size) {
    if (active) return
    active = true;

    [...Array(9).keys()].forEach(() => {
      this.push(toMsg({
        type: 'payment',
        created: momentUnix(),
        parties: [0],
        success: 1
      }))
    })

    let time = new Date((momentUnix() + 2) * 1000) // + 2 sec
    tk.freeze(time)

    this.push(toMsg({
      type: 'payment',
      created: momentUnix(),
      parties: [0],
      success: 1
    }))

    setImmediate(function () {
      tk.reset(time)
      // Go ahead of time so the payment  service
      // shouldn't have successful payments for the
      // current party during the last reaction time
      time = new Date((momentUnix() + 6) * 1000) // + 6 sec
      tk.freeze(time)

      this.push(toMsg({
        type: 'health',
        created: momentUnix(),
        party: [0]
      }))
      this.push(null)
    }.bind(this))

    // Assert
    setTimeout(() => {
      tk.reset(time)

      t.equal(respond.callCount, 1)
      t.ok(!!respond.firstCall.args)
      t.equal(respond.firstCall.args.length, 2)

      const res = bufToJSON(respond.firstCall.args[0])
      const src = bufToJSON(respond.firstCall.args[1])

      t.equal(res.type, 'health')
      t.ok(!!res.party.length)
      t.equal(res.party[0], 0)

      t.equal(src.type, 'healthy')
      t.ok(!!src.party.length)
      t.equal(src.party[0], 0)
      t.equal(src.status, 0)

      t.end()
    }, 500)
  })

  service({ stream: mockedNetwork, network: { respond } })
})
