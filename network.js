'use strict'

const {
  serialize,
  momentUnix,
  log: logger
} = require('./utils')

module.exports.createSource = createSource
module.exports.respond = respond

const {
  NODE_ENV,
  PARTIES_COUNT = 10,
  LOG_LEVEL = (NODE_ENV === 'development' ? 'debug' : 'error')
} = process.env

const log = LOG_LEVEL === 'debug' ? logger('Test Network Service') : () => {}

const getRandomNum = (min, max) => Math.random() * (max - min) + min
const getRandomInt = (min, max) => Math.round(getRandomNum(min, max))
const sendPayment = () => getRandomInt(0, 1) === 0
const getSendMsgDelay = () => getRandomNum(600, 3000)

function createSource (end, cb) {
  if (end) return cb(end)

  const parties = [...Array(PARTIES_COUNT).keys()]

  const getRandomParty = () => parties[getRandomInt(0, parties.length - 1)]
  const getRandomParties = () => (
    [...Array(getRandomInt(1, parties.length - 1)).keys()]
      .reduce((acc, curr) => {
        let party = getRandomParty()
        while (acc.includes(party)) {
          party = getRandomParty()
        }
        acc.push(party)
        return acc
      }, [])
  )

  const sendMsg = function () {
    const body = sendPayment() ? {
      type: 'payment',
      created: momentUnix(),
      parties: getRandomParties(),
      success: getRandomInt(0, 1) === 1
    } : {
      type: 'health',
      created: momentUnix(),
      party: getRandomParty()
    }
    cb(null, body)
  }

  setTimeout(sendMsg, getSendMsgDelay())
}

function respond (src, res) {
  log('Response received:', serialize(res), 'for event:', serialize(src))
}
