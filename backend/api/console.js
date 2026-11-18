const express = require('express')
const { query } = require('../../db/pool')
const { requireWorkspaceRole, requireStaff } = require('./auth')

const router = express.Router()
const ROLES = ['owner', 'admin', 'approver', 'operator', 'viewer']

async function workspace(req, res) { return requireWorkspaceRole(req, res, ROLES) }

router.get('/executions', async (req, res) => {
  const actor = await workspace(req, res); if (!actor) return
  const result = await query(
    `SELECT e.id, e.status, e.started_at, e.ended_at, e.duration_ms, e.total_cost::float, e.failed_cost::float,
            e.retry_cost::float, w.name AS workflow, w.actor,
            (SELECT COUNT(*)::int FROM execution_steps s WHERE s.execution_id = e.id) AS step_count
     FROM workflow_executions e JOIN workflows w ON w.id = e.workflow_id
     WHERE e.customer_id = $1 ORDER BY e.started_at DESC LIMIT 200`, [actor.customer_id]
  )
  res.json({ executions: result.rows })
})

router.get('/executions/:id', async (req, res) => {
  const actor = await workspace(req, res); if (!actor) return
  const execution = await query(
    `SELECT e.*, w.name AS workflow, w.actor FROM workflow_executions e
     JOIN workflows w ON w.id = e.workflow_id WHERE e.id = $1 AND e.customer_id = $2`,
    [req.params.id, actor.customer_id]
  )
  if (!execution.rows.length) return res.status(404).json({ error: 'Execution not found' })
  const steps = await query(
    `SELECT id, name, status, started_at, ended_at, duration_ms, total_cost::float, failed_cost::float, cursor,
            progress_done, progress_total, checkpoint_at FROM execution_steps WHERE execution_id = $1 ORDER BY started_at`,
    [req.params.id]
  )
  res.json({ execution: execution.rows[0], steps: steps.rows })
})

router.get('/cost', async (req, res) => {
  const actor = await workspace(req, res); if (!actor) return
  const result = await query(
    `SELECT COALESCE(SUM(total_cost),0)::float AS observed_cost, COALESCE(SUM(failed_cost),0)::float AS retry_waste,
            COALESCE(SUM(retry_cost),0)::float AS retry_cost,
            COUNT(*) FILTER (WHERE status IN ('failed','partial'))::int AS affected_executions
     FROM workflow_executions WHERE customer_id = $1 AND started_at > now() - interval '30 days'`, [actor.customer_id]
  )
  const value = result.rows[0]
  res.json({ cost: { ...value, estimated_avoidable_cost: Number((Number(value.retry_waste || 0) + Number(value.retry_cost || 0)).toFixed(2)) } })
})

router.get('/audit', async (req, res) => {
  const actor = await workspace(req, res); if (!actor) return
  const result = await query(
    `SELECT a.id, a.event_type, a.details, a.created_at, r.status, r.action, r.id AS recovery_request_id, u.email AS actor_email
     FROM recovery_audit_events a JOIN recovery_requests r ON r.id = a.recovery_request_id
     LEFT JOIN workspace_users u ON u.id = a.actor_user_id
     WHERE a.customer_id = $1 ORDER BY a.id DESC LIMIT 200`, [actor.customer_id]
  )
  res.json({ events: result.rows })
})

router.get('/settings', async (req, res) => {
  const actor = await workspace(req, res); if (!actor) return
  const result = await query('SELECT company, interrupt_after_minutes, webhook_url FROM customers WHERE id = $1', [actor.customer_id])
  res.json({ settings: result.rows[0] || {} })
})

router.patch('/settings', async (req, res) => {
  const actor = await requireWorkspaceRole(req, res, ['owner', 'admin']); if (!actor) return
  const minutes = Number(req.body?.interrupt_after_minutes)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return res.status(400).json({ error: 'Stall threshold must be between 1 and 1440 minutes' })
  const result = await query('UPDATE customers SET interrupt_after_minutes = $2 WHERE id = $1 RETURNING company, interrupt_after_minutes, webhook_url', [actor.customer_id, minutes])
  res.json({ settings: result.rows[0] })
})

router.get('/staff/fleet', async (req, res) => {
  const staff = await requireStaff(req, res); if (!staff) return
  const [workspaces, applications, worker, recoveries] = await Promise.all([
    query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active FROM customers"),
    query("SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending FROM workspace_applications"),
    query('SELECT MAX(last_seen_at) AS last_seen_at FROM worker_heartbeats'),
    query("SELECT COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending FROM recovery_requests"),
  ])
  res.json({ fleet: { workspaces: workspaces.rows[0], applications: applications.rows[0], worker: worker.rows[0], recoveries: recoveries.rows[0] } })
})

module.exports = router
