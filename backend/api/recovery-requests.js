const express = require('express')
const { randomUUID } = require('crypto')
const { pool, query } = require('../../db/pool')
const { requireWorkspaceRole } = require('./auth')
const { canTransition } = require('../recovery/states')
const { publishWorkspaceEvent } = require('../events/publish')

const router = express.Router()
const DECIDERS = ['owner', 'admin', 'approver']
const CREATORS = ['owner', 'admin', 'approver', 'operator']

function audit(client, request, actorId, eventType, details = {}) {
  return client.query(
    `INSERT INTO recovery_audit_events
       (recovery_request_id, customer_id, actor_user_id, event_type, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [request.id, request.customer_id, actorId || null, eventType, JSON.stringify(details)]
  )
}

router.get('/', async (req, res) => {
  const actor = await requireWorkspaceRole(req, res, ['owner', 'admin', 'approver', 'operator', 'viewer'])
  if (!actor) return
  const status = String(req.query.status || '')
  const params = [actor.customer_id]
  const where = ['r.customer_id = $1']
  if (status) {
    params.push(status)
    where.push(`r.status = $${params.length}`)
  }
  try {
    const result = await query(
      `SELECT r.*, w.name AS workflow_name, i.name AS integration_name,
              requester.email AS requested_by_email, approver.email AS approved_by_email
       FROM recovery_requests r
       JOIN workflow_executions e ON e.id = r.execution_id
       JOIN workflows w ON w.id = e.workflow_id
       LEFT JOIN workspace_integrations i ON i.id = r.integration_id
       LEFT JOIN workspace_users requester ON requester.id = r.requested_by
       LEFT JOIN workspace_users approver ON approver.id = r.approved_by
       WHERE ${where.join(' AND ')}
       ORDER BY r.created_at DESC LIMIT 100`,
      params
    )
    return res.json({ recovery_requests: result.rows })
  } catch (err) {
    console.error('[recovery-requests/list]', err.message)
    return res.status(500).json({ error: 'Failed to list recovery requests' })
  }
})

router.post('/', async (req, res) => {
  const actor = await requireWorkspaceRole(req, res, CREATORS)
  if (!actor) return
  const { execution_id, integration_id = null, source = 'manual', action, action_snapshot = {}, expires_at } = req.body || {}
  if (!execution_id || !['failure', 'stall', 'manual'].includes(source) || !['retry', 'resume'].includes(action)) {
    return res.status(400).json({ error: 'execution_id, valid source, and retry or resume action are required' })
  }
  try {
    const execution = await query(
      'SELECT id FROM workflow_executions WHERE id = $1 AND customer_id = $2',
      [execution_id, actor.customer_id]
    )
    if (!execution.rows.length) return res.status(404).json({ error: 'Execution not found' })
    if (integration_id) {
      const integration = await query(
        `SELECT id FROM workspace_integrations
         WHERE id = $1 AND customer_id = $2 AND active = true AND supports_idempotency_key = true`,
        [integration_id, actor.customer_id]
      )
      if (!integration.rows.length) return res.status(400).json({ error: 'Integration must be active and support idempotency keys' })
    }
    const created = await query(
      `INSERT INTO recovery_requests
        (customer_id, execution_id, integration_id, source, action, action_snapshot, requested_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now() + INTERVAL '24 hours'))
       RETURNING *`,
      [actor.customer_id, execution_id, integration_id, source, action, JSON.stringify(action_snapshot), actor.user_id, expires_at || null]
    )
    const request = created.rows[0]
    await query(
      `INSERT INTO recovery_audit_events (recovery_request_id, customer_id, actor_user_id, event_type, details)
       VALUES ($1, $2, $3, 'created', $4)`,
      [request.id, actor.customer_id, actor.user_id, JSON.stringify({ source, action })]
    )
    await publishWorkspaceEvent(actor.customer_id, 'recovery.created', { recovery_request_id: request.id })
    return res.status(201).json({ recovery_request: request })
  } catch (err) {
    console.error('[recovery-requests/create]', err.message)
    return res.status(500).json({ error: 'Failed to create recovery request' })
  }
})

router.post('/:id/approve', async (req, res) => decide(req, res, 'approve'))
router.post('/:id/reject', async (req, res) => decide(req, res, 'reject'))

async function decide(req, res, decision) {
  const actor = await requireWorkspaceRole(req, res, DECIDERS)
  if (!actor) return
  const reason = req.body?.reason == null ? null : String(req.body.reason).slice(0, 2000)
  const targetStatus = decision === 'approve' ? 'approved' : 'rejected'
  if (!canTransition('pending_approval', targetStatus)) {
    return res.status(500).json({ error: 'Recovery state machine is misconfigured' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const status = targetStatus
    const fields = decision === 'approve'
      ? 'approved_by = $3, approved_at = now()'
      : 'rejected_by = $3, rejected_at = now()'
    const updated = await client.query(
      `UPDATE recovery_requests SET status = $4, ${fields}, decision_reason = $5, updated_at = now()
       WHERE id = $1 AND customer_id = $2 AND status = 'pending_approval' AND expires_at > now()
       RETURNING *`,
      [req.params.id, actor.customer_id, actor.user_id, status, reason]
    )
    if (!updated.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Request is no longer awaiting approval' })
    }
    const request = updated.rows[0]
    await audit(client, request, actor.user_id, status, { reason })
    if (decision === 'approve') {
      await client.query(
        `INSERT INTO jobs (kind, payload, run_at)
         VALUES ('dispatch_recovery', $1, now())`,
        [JSON.stringify({ recovery_request_id: request.id, idempotency_key: randomUUID() })]
      )
      await audit(client, request, actor.user_id, 'dispatch_queued')
    }
    await client.query('COMMIT')
    await publishWorkspaceEvent(actor.customer_id, `recovery.${status}`, { recovery_request_id: request.id })
    return res.json({ recovery_request: request })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[recovery-requests/decision]', err.message)
    return res.status(500).json({ error: 'Failed to record decision' })
  } finally {
    client.release()
  }
}

module.exports = router
