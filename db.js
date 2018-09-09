'use strict'

module.exports.parties = () => {
  let _parties = {}
  return {
    get: (partyId) => typeof partyId !== 'undefined' ? _parties[partyId] : _parties,
    set: (partyId, party) => (_parties[partyId] = party)
  }
}
