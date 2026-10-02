'use strict'

const ReadyResource = require('ready-resource')
const FramedStream = require('framed-stream')

const CLOSE_TIMEOUT_MS = 5000

/**
 * The host half of the hello-pear-bare shape.
 *
 * It spawns the Bare worker that owns the peer-to-peer code and the updater,
 * wraps the IPC pipe in length-prefixed framing, and turns the worker's
 * messages into events `bin.mjs` can print. Keeping the peer-to-peer work off
 * this thread keeps the CLI responsive.
 */
class App extends ReadyResource {
  constructor (opts = {}) {
    super()

    this.dir = opts.dir
    this.app = opts.app ?? null
    this.updates = opts.updates !== false
    this.version = opts.version ?? '0.0.0-0'
    this.upgrade = opts.upgrade ?? ''
    this.name = opts.name ?? 'hive'
    this.port = opts.port ?? 3000
    this.transports = (opts.transports ?? ['ws', 'swarm'])
      .filter((id) => !(id === 'swarm' && opts.swarm === false))

    this.url = null
    this.link = null
    this.pubkey = null
    this.IPC = null
    this.pipe = null
    this._workerClosed = null
  }

  _open () {
    const PearRuntime = require('pear-runtime')

    this.IPC = PearRuntime.run(require.resolve('./workers/main.js'), [
      String(this.updates),
      this.version,
      this.upgrade,
      this.name,
      this.dir,
      this.app ?? '',
      String(this.port),
      this.transports.join(',')
    ])

    this.pipe = new FramedStream(this.IPC)
    this.pipe.on('data', (data) => this._onmessage(data))
    this.pipe.on('error', (err) => this.emit('error', err))
  }

  _onmessage (data) {
    let message
    try {
      message = JSON.parse(data.toString())
    } catch {
      return
    }

    switch (message.type) {
      case 'transport':
        this.emit('transport', message)
        // The two built-in transports keep their own events.
        if (message.id === 'ws') {
          this.url = message.url
          this.emit('listening', message)
        } else if (message.id === 'swarm') {
          this.link = message.link
          this.emit('swarm', message)
        }
        break

      case 'closed':
        this._workerClosed?.()
        break

      case 'ready':
        this.pubkey = message.pubkey
        this.emit('ready-relay', message)
        break

      case 'updating':
      case 'updated':
      case 'update-applied':
      case 'updater-ready':
      case 'updater-disabled':
        this.emit(message.type, message)
        break

      case 'error':
        this.emit('worker-error', message)
        break

      default:
        this.emit('message', message)
    }
  }

  async _close () {
    // Wait for the worker to report that it closed its transports, updater and
    // store. The timeout covers a worker that is stuck or already gone.
    const closed = new Promise((resolve) => { this._workerClosed = resolve })

    try {
      this.pipe?.write(JSON.stringify({ type: 'close' }))
    } catch {
      this._workerClosed()
    }

    await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, CLOSE_TIMEOUT_MS))])

    try {
      this.IPC?.destroy()
    } catch {}
  }

  async exit (code = 0) {
    await this.close()
    if (typeof Bare !== 'undefined') Bare.exit(code)
    else process.exit(code)
  }
}

module.exports = App
