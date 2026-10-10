const express = require('express')
const { v4: uuid } = require('uuid')
const { requireAuth } = require('./auth')
const { applyBatch } = require('../intelligence/apply')
const { TREE_KINDS, isLeafKind } = require('../intelligence/kinds')

const router = express.Router()

router.post('/', async (req, res) => {
  const customer = await requireAuth(req, res)
  if (!customer) return

  const { logs } = req.body

  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({
      error: 'Body must contain a non-empty logs array',
      example: {
        logs: [{
          endpoint:   '/v1/generate',
          status:     'fail',
          latency_ms: 920,
          price:      0.02,
          error_type: 'timeout'
        }]
      }
    })
  }

  if (logs.length > 500) {
    return res.status(400).json({ error: 'Max 500 logs per batch. Send multiple batches for larger volumes.' })
  }

  const valid = []
  const invalid = []

  for (const log of logs) {
    const kind = log.kind || 'api_call'
    const status = log.status
    if (status && !['success', 'fail'].includes(status)) {
      invalid.push({ log, reason: 'status must be "success" or "fail"' })
      continue
    }

    const isLeaf = isLeafKind(kind)
    const endpoint = (log.endpoint || log.tool || '').toString()

    if (isLeaf && !TREE_KINDS.has(kind) && !endpoint) {
      invalid.push({ log, reason: 'endpoint required (string)' })
      continue
    }
    if (TREE_KINDS.has(kind) && !log.workflow && !log.step && kind !== 'workflow_end') {
      invalid.push({ log, reason: 'workflow or step name required' })
      continue
    }

    valid.push({
      kind,
      isLeaf: isLeaf && !TREE_KINDS.has(kind),
      request_id: log.request_id || uuid(),
      endpoint: endpoint ? endpoint.slice(0, 255) : (log.step || log.workflow || 'unknown').toString().slice(0, 255),
      status: status || 'success',
      latency_ms: Number.isInteger(log.latency_ms) ? log.latency_ms : null,
      price: parseFloat(log.price) || customer.price_default,
      error_type: log.error_type ? String(log.error_type).slice(0, 100) : null,
      workflow: log.workflow ? String(log.workflow).slice(0, 255) : null,
      step: log.step ? String(log.step).slice(0, 255) : null,
      tool: log.tool ? String(log.tool).slice(0, 255) : null,
      execution_id: log.execution_id || null,
      step_id: log.step_id || null,
      parent_step_id: log.parent_step_id || null,
      depends_on: Array.isArray(log.depends_on) ? log.depends_on : [],
      attempt: parseInt(log.attempt) > 0 ? parseInt(log.attempt) : 1,
      started_at: log.started_at ? new Date(log.started_at) : null,
      ended_at: log.ended_at || log.timestamp ? new Date(log.ended_at || log.timestamp) : null,
      recovery_of: log.recovery_of || null,
      actor: log.actor || null,
      for_execution_id: log.for_execution_id || null,
      for_step: log.for_step ? String(log.for_step).slice(0, 255) : null,
      hits: Number.isInteger(log.hits) ? log.hits : null,
      cursor: log.cursor != null ? log.cursor : null,
      progress_done: Number.isInteger(log.progress_done) ? log.progress_done : (Number.isInteger(log.done) ? log.done : null),
      progress_total: Number.isInteger(log.progress_total) ? log.progress_total : (Number.isInteger(log.total) ? log.total : null),
      cost_kind: log.cost_kind || null,
    })
  }

  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid log entries', invalid })
  }

  try {
    await applyBatch(customer, valid)

    return res.status(200).json({
      ok:       true,
      accepted: valid.length,
      rejected: invalid.length,
      ...(invalid.length > 0 ? { invalid } : {})
    })
  } catch (err) {
    console.error('[ingest] DB insert failed:', err.message)
    return res.status(500).json({ error: 'Failed to store logs. Try again.' })
  }
})

module.exports = router
