const { current } = require('./context')

function checkpoint(client, opts = {}) {
  const ctx = current()
  if (!ctx.stepId) throw new Error('[Fluxera] checkpoint() must run inside step()')
  const done = Number.isInteger(opts.done) ? opts.done : null
  const total = Number.isInteger(opts.total) ? opts.total : null
  const cursor = opts.cursor != null ? String(opts.cursor) : null
  client._enqueue({
    kind: 'checkpoint',
    status: 'success',
    workflow: ctx.workflow || null,
    execution_id: ctx.executionId || null,
    step_id: ctx.stepId,
    step: ctx.step || null,
    endpoint: ctx.step || 'checkpoint',
    progress_done: done,
    progress_total: total,
    cursor,
    timestamp: new Date().toISOString(),
  })
}

module.exports = { checkpoint }
