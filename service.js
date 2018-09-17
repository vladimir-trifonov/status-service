'use strict'

const logger = require('./logger')

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

module.exports = function ({ setTimeout, respond }) {
  return (read) => {
    const startTime = new Date().getTime()
    const partiesData = {}
    const handleMessageWithParties = handleMessage({ startTime, partiesData, setTimeout })

    read(null, function next (end, data) {
      if (end) {
        // Clear the intervals after the stream has been closed
        Object.keys(partiesData).forEach((partyId) => {
          const timeout = partiesData[partyId].timeout
          if (timeout) {
            try {
              clearTimeout(timeout)
            } catch (e) {}
          }
        })
        return
      }

      handleMessageWithParties(data, respond)
      read(null, next)
    })
  }
}

function handleMessage ({ startTime, partiesData, setTimeout }) {
  return (event = {}, respond) => {
    const { type: eventType, party: partyId, parties, success } = event
    log('Request received:', event)

    switch (eventType) {
      case PAYMENT:
        updateStatus({ startTime, partiesData, setTimeout }, { parties, success })
        break
      case HEALTH:
        const status = getStatusEvent(partiesData, partyId)
        typeof status !== 'undefined' && respond(event, status)
        break
    }
  }
}

function getStatusEvent (partiesData, partyId) {
  const party = partiesData[partyId]
  if (!party || party.reactionTime === null) return

  const hasHealthyPayment = !!party.lastHealthyReceivedAt
  const degradedTimeOffset = new Date().getTime() - party.reactionTime
  const healthy = (hasHealthyPayment && party.lastHealthyReceivedAt >= degradedTimeOffset)

  return {
    type: 'health-status',
    created: new Date(),
    party: partyId,
    healthy
  }
}

function updateStatus ({ startTime, partiesData, setTimeout }, { parties = [], success }) {
  const currentTime = new Date().getTime()

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
          reactionTime: currentTime - startTime,
          timeout: setReactionTime({ partiesData, setTimeout }, partyId)
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

function setReactionTime ({ partiesData, setTimeout }, partyId) {
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
      timeout: setReactionTime({ partiesData, setTimeout }, partyId)
    }

    log('Reaction Time for party:', partyId, 'has been updated to:', reactionTime, 'ms')
  }, reactionTime)
}
