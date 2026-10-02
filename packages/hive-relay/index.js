'use strict'

const { Relay, Connection } = require('./lib/relay')
const { SubscriptionRegistry, channelsFromFilters } = require('./lib/subscriptions')
const protocol = require('./lib/protocol')
const handlers = require('./lib/handlers')
const { MediaStore } = require('./lib/media')
const transports = require('./lib/transports')

module.exports = {
  Relay,
  Connection,
  SubscriptionRegistry,
  channelsFromFilters,
  protocol,
  handlers,
  MediaStore,
  transports,
  Transport: transports.Transport,
  TransportClient: transports.TransportClient,
  WebSocketTransport: transports.WebSocketTransport,
  SwarmTransport: transports.SwarmTransport
}
