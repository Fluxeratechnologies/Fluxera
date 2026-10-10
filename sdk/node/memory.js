const { current } = require('./context')
const { workflow } = require('./workflow')

function finiteHits(v) {
  return typeof v === 'number' && Number.isInteger(v) ? v : null
}

function memory(client, name, fn, opts = {}) {
  if (typeof fn !== 'function') throw new Error('[Fluxera] memory() requires a function')
  const parent = current()
  const link = {}
  if (parent.actor === 'agent' && parent.executionId) {
    link.for_execution_id = parent.executionId
    if (parent.step) link.for_step = parent.step
  }
  const fromOpts = finiteHits(opts.hits)
  const hitsBox = { hits: fromOpts }
  return workflow(client, name, async () => {
    const result = await fn()
    if (fromOpts == null && result && typeof result === 'object') {
      const fromReturn = finiteHits(result.hits)
      if (fromReturn != null) hitsBox.hits = fromReturn
    }
    return result
  }, {
    ...opts,
    actor: 'memory',
    ...link,
    hitsBox,
  })
}

module.exports = { memory }
