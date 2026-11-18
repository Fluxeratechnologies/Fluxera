const express = require('express')
const { query } = require('../../db/pool')
const { requireWorkspaceRole } = require('./auth')

const router = express.Router()

router.get('/', async (req, res) => {
  const actor = await requireWorkspaceRole(req, res, ['owner', 'admin', 'approver', 'operator', 'viewer'])
  if (!actor) return
  try {
    const customerId = actor.customer_id
    const [metrics, executions, recovery, integrations, queue, worker] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'fail')::int AS failed,
                    COALESCE(SUM(price) FILTER (WHERE status = 'fail'), 0)::float AS failed_cost
             FROM request_logs WHERE customer_id = $1 AND logged_at > now() - interval '24 hours'`, [customerId]),
      query(`SELECT e.id, w.name AS workflow, w.actor, e.status, e.started_at, e.duration_ms,
                    e.total_cost::float AS total_cost, e.failed_cost::float AS failed_cost
             FROM workflow_executions e JOIN workflows w ON w.id = e.workflow_id
             WHERE e.customer_id = $1 ORDER BY e.started_at DESC LIMIT 12`, [customerId]),
      query(`SELECT COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending,
                    COUNT(*) FILTER (WHERE status IN ('dispatching','dispatched'))::int AS in_flight,
                    COUNT(*) FILTER (WHERE status = 'verification_failed')::int AS verification_failed
             FROM recovery_requests WHERE customer_id = $1`, [customerId]),
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active
             FROM workspace_integrations WHERE customer_id = $1`, [customerId]),
      query(`SELECT COUNT(*) FILTER (WHERE j.run_at <= now())::int AS ready,
                    COUNT(*) FILTER (WHERE j.run_at > now())::int AS delayed,
                    COALESCE(MAX(EXTRACT(epoch FROM now() - j.run_at)) FILTER (WHERE j.run_at <= now()), 0)::int AS oldest_lag_seconds
             FROM jobs j
             WHERE j.completed_at IS NULL AND j.failed_at IS NULL
               AND (j.payload->>'recovery_request_id') IN (SELECT id::text FROM recovery_requests WHERE customer_id = $1)`, [customerId]),
      query(`SELECT MAX(last_seen_at) AS last_seen_at FROM worker_heartbeats`),
    ])
    const m = metrics.rows[0]
    const w = worker.rows[0]
    const seen = w.last_seen_at ? new Date(w.last_seen_at) : null
    const workerAge = seen ? Math.max(0, Math.round((Date.now() - seen.getTime()) / 1000)) : null
    return res.json({
      generated_at: new Date().toISOString(),
      workspace: { id: customerId, company: actor.company, role: actor.role },
      health: {
        api: 'healthy', database: 'healthy',
        worker: workerAge != null && workerAge <= 45 ? 'healthy' : 'degraded',
        worker_last_seen_seconds: workerAge,
      },
      metrics: {
        total_executions: m.total, failed_executions: m.failed,
        failure_rate: m.total ? Number(((m.failed / m.total) * 100).toFixed(1)) : 0,
        observed_failed_cost: m.failed_cost,
      },
      recoveries: recovery.rows[0], integrations: integrations.rows[0], queue: queue.rows[0],
      executions: executions.rows,
    })
  } catch (err) {
    console.error('[operations]', err.message)
    return res.status(500).json({ error: 'Failed to load live operations' })
  }
})

module.exports = router
