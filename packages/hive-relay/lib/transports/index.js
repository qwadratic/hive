'use strict'

const registry = require('./registry')
const { Transport, TransportClient } = require('./transport')
const { WebSocketTransport, WebSocketClient } = require('./ws')
const { SwarmTransport, SwarmClient } = require('./swarm')

registry.registerTransport({
  id: 'ws',
  schemes: ['ws', 'http'],
  capabilities: { encrypted: false, http: true },
  Server: WebSocketTransport,
  Client: WebSocketClient
})

registry.registerTransport({
  id: 'swarm',
  schemes: ['hyper'],
  capabilities: { encrypted: true, http: false },
  Server: SwarmTransport,
  Client: SwarmClient
})

module.exports = {
  ...registry,
  Transport,
  TransportClient,
  WebSocketTransport,
  WebSocketClient,
  SwarmTransport,
  SwarmClient
}
