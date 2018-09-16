'use strict'

const {
  serialize,
  momentUnix,
  log: logger,
  msToSes,
  secToMs
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

const log = LOG_LEVEL === 'debug' ? logger('Health Service') : () => {}

module.exports = function (respond) {
  return (read) => {
    const startTime = momentUnix()
    const partiesData = {}
    const handleMessageWithParties = handleMessage({ startTime, partiesData })

    read(null, function next (end, data) {
      if (end) {
        // Clear the intervals after the stream has been closed
        Object.keys(partiesData).forEach((partyId) => {
          const timeout = partiesData[partyId].timeout
          timeout && clearTimeout(timeout)
        })
        return
      }

      handleMessageWithParties(data, data, respond)
      read(null, next)
    })
  }
}

function handleMessage ({ startTime, partiesData }) {
  return (originalEvent, event = {}, respond) => {
    const { type: eventType, party: partyId, parties, success } = event
    log('Request received:', serialize(event))

    switch (eventType) {
      case PAYMENT:
        updateStatus({ startTime, partiesData }, { parties, success })
        break
      case HEALTH:
        const status = genStatusEvent(partiesData, partyId)
        typeof status !== 'undefined' && respond(originalEvent, status)
        break
    }
  }
}

function genStatusEvent (partiesData, partyId) {
  const party = partiesData[partyId]
  if (!party || party.reactionTime === null) return

  const hasHealthyPayment = !!party.lastHealthyReceivedAt
  const degradedTimeOffset = momentUnix() - msToSes(party.reactionTime)
  const healthy = (hasHealthyPayment && party.lastHealthyReceivedAt >= degradedTimeOffset)

  return {
    type: 'health-status',
    created: momentUnix(),
    party: partyId,
    healthy
  }
}

function getReactionTimeTimeout (partiesData, partyId) {
  const { reactionTime } = partiesData[partyId]

  return setTimeout(() => {
    const party = partiesData[partyId]
    let reactionTime = party.reactionTime

    if (party.count) {
      const decReactionTime = reactionTime / 2
      reactionTime = party.count < LOWER_BOUND
        ? reactionTime * 2
        : party.count > HIGHER_BOUND
          ? decReactionTime > MIN_REACTION_TIME ? decReactionTime : reactionTime
          : reactionTime
    }

    partiesData[partyId] = {
      ...party,
      count: 0,
      reactionTime,
      timeout: getReactionTimeTimeout(partiesData, partyId)
    }

    log('Reaction Time for party:', partyId, 'has been updated to:', msToSes(reactionTime), 'seconds')
  }, reactionTime)
}

function updateStatus ({ startTime, partiesData }, { parties = [], success }) {
  const currentTime = momentUnix()

  parties.forEach((partyId) => {
    const party = partiesData[partyId]
    let updated

    if (party) {
      const canSetReactionTime = (party.reactionTime === null && party.count + 1 === LOWER_BOUND)
      const resetCount = canSetReactionTime

      updated = {
        ...party,
        count: resetCount ? 0 : party.count + 1,
        ...canSetReactionTime && {
          reactionTime: secToMs(currentTime - startTime),
          timeout: getReactionTimeTimeout(partiesData, partyId)
        },
        ...success && { lastHealthyReceivedAt: currentTime }
      }
    } else {
      updated = {
        count: 1,
        reactionTime: null,
        timeout: null,
        lastHealthyReceivedAt: success ? currentTime : null
      }
    }

    partiesData[partyId] = updated
  })
}
