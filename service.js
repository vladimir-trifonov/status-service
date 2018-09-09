'use strict'

const Writable = require('stream').Writable
const {
  serialize,
  momentUnix,
  log: logger,
  msToSes,
  secToMs,
  toMsg,
  bufToJSON
} = require('./utils')

const {
  NODE_ENV,
  MIN_REACTION_TIME = 100,
  LOG_LEVEL = (NODE_ENV === 'development' ? 'debug' : 'error')
} = process.env

const PAYMENT = 'payment'
const HEALTH = 'health'
const LOWER_BOUND = 10
const HIGHER_BOUND = 20

let startTime
let { parties: createPartiesDb } = require('./db')

const log = LOG_LEVEL === 'debug' ? logger('Health Service') : () => {}
const isReadableStream = (stream) => stream instanceof require('stream').Readable

module.exports = function ({ stream, network }) {
  startTime = momentUnix()
  const ws = new Writable()
  const partiesDb = createPartiesDb()
  const handleMessageWithParties = handleMessage(partiesDb)

  ws._write = function (buf, enc, next) {
    handleMessageWithParties(buf, bufToJSON(buf), network.respond)
    next()
  }

  ws.on('finish', () => {
    // Clear the intervals after the stream has been closed
    Object.keys(partiesDb.get()).forEach((partyId) => {
      const interval = partiesDb.get(partyId).interval
      interval && clearInterval(interval)
      // Close db connection if we have such an option
      // ...
    })
  })

  if (stream) {
    const source = stream.createSource()
    isReadableStream(source) && source.pipe(ws)
  } else return ws
}

function handleMessage (partiesDb) {
  return (originalEvent, event = {}, respond) => {
    const { type: eventType, party: partyId, parties, success } = event
    log('Request received:', serialize(event))

    switch (eventType) {
      case PAYMENT:
        process.nextTick(() => updateStatus(partiesDb, { parties, success }))
        break
      case HEALTH:
        process.nextTick(() => {
          const status = genStatusEvent(partiesDb, partyId)
          typeof status !== 'undefined' && respond(originalEvent, toMsg(status))
        })
        break
    }
  }
}

function genStatusEvent (partiesDb, partyId) {
  const party = partiesDb.get(partyId)
  if (!party) return

  const hasReactionTime = party.reactionTime !== null
  const hasHealthyPayment = !!party.lastHealthyReceivedAt
  let status

  if (hasReactionTime) {
    const degradedTimeOffset = momentUnix() - msToSes(party.reactionTime)
    status = (hasHealthyPayment && party.lastHealthyReceivedAt >= degradedTimeOffset) ? 1 : 0
  } else {
    status = hasHealthyPayment ? 1 : 0
  }

  return {
    type: 'healthy',
    created: momentUnix(),
    party: partyId,
    status
  }
}

function calcReactionTime (partiesDb, partyId) {
  const { reactionTime } = partiesDb.get(partyId)

  return setInterval(() => {
    const party = partiesDb.get(partyId)
    let reactionTime = party.reactionTime

    clearInterval(party.interval)

    if (party.count) {
      const decReactionTime = reactionTime / 2
      reactionTime = party.count < LOWER_BOUND
        ? reactionTime * 2
        : party.count > HIGHER_BOUND
          ? decReactionTime > MIN_REACTION_TIME ? decReactionTime : reactionTime
          : reactionTime
    }

    partiesDb.set(partyId, {
      ...party,
      count: 0,
      reactionTime,
      interval: calcReactionTime(partiesDb, partyId)
    })

    log('Reaction Time for party:', partyId, 'has been updated to:', msToSes(reactionTime), 'seconds')
  }, reactionTime)
}

function updateStatus (partiesDb, { parties = [], success }) {
  const currentTime = momentUnix()

  parties.forEach((partyId) => {
    const party = partiesDb.get(partyId)
    let updated

    if (party) {
      const canSetReactionTime = (party.reactionTime === null && party.count + 1 === LOWER_BOUND)
      const resetCount = canSetReactionTime

      updated = {
        ...party,
        count: resetCount ? 0 : party.count + 1,
        ...canSetReactionTime && {
          reactionTime: secToMs(currentTime - startTime),
          interval: calcReactionTime(partiesDb, partyId)
        },
        ...success && { lastHealthyReceivedAt: currentTime }
      }
    } else {
      updated = {
        count: 1,
        reactionTime: null,
        interval: null,
        lastHealthyReceivedAt: success ? currentTime : null
      }
    }

    partiesDb.set(partyId, updated)
  })
}
