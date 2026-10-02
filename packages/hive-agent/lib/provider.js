'use strict'

/**
 * The inference boundary.
 *
 * Everything above this line is protocol and everything below is a model.
 * Keeping them apart lets the relay and agent test suites run without a GPU,
 * model download or network, and lets a persona choose a local model or a
 * delegated peer without the harness changing.
 *
 *   capabilities()  -> string[]                     what this provider can do
 *   complete(req)   -> { events, final }            streaming generation
 *   embed(texts)    -> number[][]
 *   transcribe(pcm) -> { text }
 *   speak(text)     -> { audio }
 *
 * `complete` returns an object with an async-iterable `events` and a `final`
 * promise, mirroring the QVAC SDK's CompletionRun, so the real adapter is a
 * thin translation.
 */

const CAPABILITIES = {
  TEXT_GENERATION: 'text-generation',
  EMBEDDINGS: 'embeddings',
  TRANSCRIPTION: 'transcription',
  TEXT_TO_SPEECH: 'text-to-speech',
  RAG: 'rag',
  IMAGE_GENERATION: 'image-generation',
  TRANSLATION: 'translation'
}

class InferenceProvider {
  async capabilities () {
    throw new Error('not implemented')
  }

  complete () {
    throw new Error('not implemented')
  }

  async embed () {
    throw new Error(`${this.constructor.name} does not support embeddings`)
  }

  async transcribe () {
    throw new Error(`${this.constructor.name} does not support transcription`)
  }

  async speak () {
    throw new Error(`${this.constructor.name} does not support speech synthesis`)
  }

  async close () {}
}

/**
 * Deterministic provider used by every test and by `--inference mock`.
 *
 * The same history always produces the same reply, so a test can assert on
 * exact output and a failure points at the harness instead of model drift.
 */
class MockProvider extends InferenceProvider {
  constructor (opts = {}) {
    super()
    this.model = opts.model ?? 'mock-1'
    this.systemPrompt = opts.systemPrompt ?? null
    this.reply = opts.reply ?? null
    this.delay = opts.delay ?? 0
    this.calls = []
  }

  async capabilities () {
    return [CAPABILITIES.TEXT_GENERATION, CAPABILITIES.EMBEDDINGS]
  }

  complete ({ history = [], tools = [], signal = null } = {}) {
    this.calls.push({ history, tools })

    const last = [...history].reverse().find((m) => m.role === 'user')
    const text = this.reply ?? summarize(last?.content ?? '')
    const chunks = text.match(/.{1,16}/gs) ?? ['']

    const self = this
    const final = { content: text, model: this.model, thinking: null, toolCalls: [], stats: { tokens: chunks.length } }

    return {
      events: (async function * () {
        for (const chunk of chunks) {
          if (signal?.aborted) return
          if (self.delay > 0) await new Promise((resolve) => setTimeout(resolve, self.delay))
          yield { type: 'contentDelta', text: chunk }
        }
        yield { type: 'final', final }
      })(),
      final: Promise.resolve(final)
    }
  }

  async embed (texts) {
    // Stable bag-of-characters projection. It is useless for retrieval, but it
    // is deterministic and has the right dimension, which is all a test needs.
    return (Array.isArray(texts) ? texts : [texts]).map((text) => {
      const vector = new Array(8).fill(0)
      for (let i = 0; i < text.length; i++) vector[i % 8] += text.charCodeAt(i) / 1000
      return vector
    })
  }
}

function summarize (prompt) {
  const cleaned = prompt.replace(/\s+/g, ' ').trim()
  if (cleaned.length === 0) return 'I received an empty message.'
  return `Acknowledged: ${cleaned.slice(0, 120)}`
}

module.exports = { InferenceProvider, MockProvider, CAPABILITIES }
