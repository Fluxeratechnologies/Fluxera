const express = require('express')
const { query } = require('../../db/pool')
const { requireAuth } = require('./auth')
const { windowInterval } = require('../intelligence/availability')
const { actorFilter } = require('../intelligence/kinds')

const router = express.Router()

router.get('/', async (req, res) => {
  const customer = await requireAuth(req, res)
  if (!customer) return

  const interval = windowInterval(req.query.window)
  const actor = actorFilter(req.query.actor)
  const params = [customer.id]
  const where = ['w.customer_id = $1']
  if (actor) {
    params.push(actor)
    where.push(`w.actor = $${params.length}`)
  }

  try {
    const result = await query(
      `SELECT
         w.id, w.name, w.actor, w.created_at,
         COUNT(e.id) AS executions,
         COUNT(e.id) FILTER (WHERE e.status = 'failed') AS failed,
         COUNT(e.id) FILTER (WHERE e.status = 'partial') AS partial,
         ROUND(
           COUNT(e.id) FILTER (WHERE e.status IN ('failed','partial'))::NUMERIC
           / NULLIF(COUNT(e.id), 0) * 100, 2
         ) AS failure_rate,
         COALESCE(SUM(e.total_cost), 0) AS total_cost,
         COALESCE(SUM(e.failed_cost), 0) AS failed_cost,
         COALESCE(SUM(e.retry_cost), 0) AS retry_cost,
         COUNT(e.id) FILTER (
           WHERE e.status IN ('failed','partial')
             AND e.started_at > now() - INTERVAL '${interval}'
         ) AS recurring_failed,
         MAX(e.started_at) FILTER (WHERE e.status IN ('failed','partial')) AS last_failed_at,
         BOOL_OR(e.status IN ('failed','partial') AND e.started_at > now() - INTERVAL '1 hour') AS still_failing,
         ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.duration_ms)
           FILTER (WHERE e.started_at > now() - INTERVAL '${interval}'))::numeric) AS p50_ms,
         ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY e.duration_ms)
           FILTER (WHERE e.started_at > now() - INTERVAL '${interval}'))::numeric) AS p95_ms,
         COALESCE((
           SELECT SUM(GREATEST(0, p.total_cost - c.total_cost))
           FROM workflow_executions c
           JOIN workflow_executions p ON p.id = c.recovery_of
           WHERE p.workflow_id = w.id
             AND c.status = 'success'
         ), 0) AS cost_avoided
       FROM workflows w
       LEFT JOIN workflow_executions e ON e.workflow_id = w.id
       WHERE ${where.join(' AND ')}
       GROUP BY w.id, w.name, w.actor, w.created_at
       ORDER BY failed_cost DESC, w.name ASC`,
      params
    )
    return res.json({ workflows: result.rows, window: interval === '7 days' ? '7d' : '24h' })
  } catch (err) {
    console.error('[workflows]', err.message)
    return res.status(500).json({ error: 'Failed to list workflows' })
  }
})

router.get('/:id', async (req, res) => {
  const customer = await requireAuth(req, res)
  if (!customer) return

  try {
    const w = await query(
      `SELECT * FROM workflows WHERE id = $1 AND customer_id = $2`,
      [req.params.id, customer.id]
    )
    if (!w.rows.length) return res.status(404).json({ error: 'Not found' })

    const stats = await query(
      `SELECT
         COUNT(*) AS executions,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed,
         COUNT(*) FILTER (WHERE status = 'partial') AS partial,
         COUNT(*) FILTER (WHERE status = 'success') AS succeeded,
         COALESCE(SUM(total_cost), 0) AS total_cost,
         COALESCE(SUM(failed_cost), 0) AS failed_cost,
         COALESCE(SUM(retry_cost), 0) AS retry_cost,
         ROUND(AVG(duration_ms), 0) AS avg_duration_ms
       FROM workflow_executions WHERE workflow_id = $1`,
      [req.params.id]
    )
    return res.json({ workflow: w.rows[0], stats: stats.rows[0] })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load workflow' })
  }
})

module.exports = router
