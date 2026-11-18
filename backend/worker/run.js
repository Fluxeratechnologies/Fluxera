require('dotenv').config()
const crypto = require('crypto')
const { randomUUID } = require('crypto')
const { pool, query } = require('../../db/pool')
const { publishWorkspaceEvent } = require('../events/publish')
const { verifyRecoveryExecution } = require('../recovery/verification')

const workerId = process.env.WORKER_ID || `worker-${randomUUID()}`
const leaseMs = Number(process.env.JOB_LEASE_MS || 30000)
const pollMs = Number(process.env.WORKER_POLL_MS || 1500)

async function claimJob() {
  const leaseToken = randomUUID()
  const result = await query(
    `WITH candidate AS (
       SELECT id FROM jobs
       WHERE completed_at IS NULL AND failed_at IS NULL AND run_at <= now()
         AND (lease_expires_at IS NULL OR lease_expires_at < now())
       ORDER BY run_at, id FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE jobs j SET locked_at = now(), lease_token = $1,
       lease_expires_at = now() + ($2 || ' milliseconds')::interval,
       attempts = attempts + 1
     FROM candidate WHERE j.id = candidate.id RETURNING j.*`,
    [leaseToken, String(leaseMs)]
  )
  return result.rows[0] || null
}

async function completeJob(job) {
  await query(
    `UPDATE jobs SET completed_at = now(), lease_token = NULL, lease_expires_at = NULL
     WHERE id = $1 AND lease_token = $2`, [job.id, job.lease_token]
  )
}

async function retryJob(job, error) {
  const terminal = job.attempts >= job.max_attempts
  const delay = Math.min(300000, 1000 * (2 ** Math.min(job.attempts, 8)))
  await query(
    `UPDATE jobs SET last_error = $3, failed_at = CASE WHEN $4 THEN now() ELSE NULL END,
       run_at = CASE WHEN $4 THEN run_at ELSE now() + ($5 || ' milliseconds')::interval END,
       lease_token = NULL, lease_expires_at = NULL
     WHERE id = $1 AND lease_token = $2`,
    [job.id, job.lease_token, String(error.message || error).slice(0, 2000), terminal, String(delay)]
  )
}

function signature(secret, timestamp, body) {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

async function dispatchRecovery(job) {
  const requestId = job.payload?.recovery_request_id
  if (!requestId) throw new Error('dispatch_recovery job missing recovery_request_id')
  const loaded = await query(
    `SELECT r.*, i.name AS integration_name, i.webhook_url, i.signing_secret, i.supports_idempotency_key, i.active,
            e.id AS original_execution_id, w.name AS workflow_name
     FROM recovery_requests r
     JOIN workspace_integrations i ON i.id = r.integration_id
     JOIN workflow_executions e ON e.id = r.execution_id
     JOIN workflows w ON w.id = e.workflow_id
     WHERE r.id = $1`, [requestId]
  )
  const request = loaded.rows[0]
  if (!request) return
  if (!request.active || !request.supports_idempotency_key) throw new Error('Integration is not eligible for recovery dispatch')
  if (!['approved', 'delivery_failed'].includes(request.status) || new Date(request.expires_at) <= new Date()) {
    if (request.status === 'approved' && new Date(request.expires_at) <= new Date()) {
      await query(`UPDATE recovery_requests SET status = 'expired', updated_at = now() WHERE id = $1`, [request.id])
    }
    return
  }
  const idempotencyKey = job.payload.idempotency_key || randomUUID()
  const claimed = await query(
    `UPDATE recovery_requests SET status = 'dispatching', dispatch_attempts = dispatch_attempts + 1,
       last_dispatched_at = now(), updated_at = now()
     WHERE id = $1 AND status IN ('approved', 'delivery_failed') RETURNING *`, [request.id]
  )
  if (!claimed.rows.length) return

  const payload = {
    recovery_id: request.id,
    recovery_of_execution_id: request.original_execution_id,
    workflow: request.workflow_name,
    action: request.action,
    action_snapshot: request.action_snapshot,
    verification: { recovery_request_id: request.id, recovery_of: request.original_execution_id },
  }
  const body = JSON.stringify(payload)
  const timestamp = new Date().toISOString()
  let response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    response = await fetch(request.webhook_url, {
      method: 'POST', signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-fluxera-timestamp': timestamp,
        'x-fluxera-signature': signature(request.signing_secret, timestamp, body),
      }, body,
    })
    clearTimeout(timer)
  } catch (err) {
    await deliveryFailed(request, `network:${err.name || 'error'}`, idempotencyKey)
    throw err
  }
  const result = { http_status: response.status, idempotency_key: idempotencyKey }
  if (!response.ok) {
    await deliveryFailed(request, result, idempotencyKey)
    throw new Error(`Recovery endpoint returned HTTP ${response.status}`)
  }
  await query(
    `UPDATE recovery_requests SET status = 'dispatched', delivery_result = $2, updated_at = now()
     WHERE id = $1`, [request.id, JSON.stringify(result)]
  )
  await query(
    `INSERT INTO recovery_audit_events (recovery_request_id, customer_id, event_type, details)
     VALUES ($1, $2, 'dispatched', $3)`, [request.id, request.customer_id, JSON.stringify(result)]
  )
  await query(
    `INSERT INTO jobs (kind, payload, run_at) VALUES ('verify_recovery', $1, now() + INTERVAL '30 seconds')`,
    [JSON.stringify({ recovery_request_id: request.id })]
  )
  await publishWorkspaceEvent(request.customer_id, 'recovery.dispatched', { recovery_request_id: request.id })
}

async function deliveryFailed(request, result, idempotencyKey) {
  const details = typeof result === 'string' ? { error: result, idempotency_key: idempotencyKey } : result
  await query(
    `UPDATE recovery_requests SET status = 'delivery_failed', delivery_result = $2, updated_at = now()
     WHERE id = $1`, [request.id, JSON.stringify(details)]
  )
  await query(
    `INSERT INTO recovery_audit_events (recovery_request_id, customer_id, event_type, details)
     VALUES ($1, $2, 'delivery_failed', $3)`, [request.id, request.customer_id, JSON.stringify(details)]
  )
  await publishWorkspaceEvent(request.customer_id, 'recovery.delivery_failed', { recovery_request_id: request.id })
}

async function verifyRecovery(job) {
  const requestId = job.payload?.recovery_request_id
  if (!requestId) throw new Error('verify_recovery job missing recovery_request_id')
  const result = await query(
    `SELECT customer_id, verification_execution_id, status FROM recovery_requests WHERE id = $1`, [requestId]
  )
  const request = result.rows[0]
  if (!request || !['dispatched', 'delivery_failed'].includes(request.status)) return
  if (!request.verification_execution_id) {
    if (job.attempts >= job.max_attempts) {
      await query(
        `UPDATE recovery_requests SET status = 'verification_failed', updated_at = now() WHERE id = $1`, [requestId]
      )
      await query(
        `INSERT INTO recovery_audit_events (recovery_request_id, customer_id, event_type, details)
         VALUES ($1, $2, 'verification_failed', $3)`,
        [requestId, request.customer_id, JSON.stringify({ reason: 'No linked SDK recovery execution arrived' })]
      )
      await publishWorkspaceEvent(request.customer_id, 'recovery.verification_failed', { recovery_request_id: requestId })
      return
    }
    throw new Error('Awaiting linked SDK recovery execution')
  }
  await verifyRecoveryExecution(request.customer_id, request.verification_execution_id, requestId)
}

async function heartbeat() {
  await query(
    `INSERT INTO worker_heartbeats (worker_id, last_seen_at, details) VALUES ($1, now(), $2)
     ON CONFLICT (worker_id) DO UPDATE SET last_seen_at = now(), details = EXCLUDED.details`,
    [workerId, JSON.stringify({ pid: process.pid })]
  )
}

async function runOnce() {
  await heartbeat()
  const job = await claimJob()
  if (!job) return false
  try {
    if (job.kind === 'dispatch_recovery') await dispatchRecovery(job)
    else if (job.kind === 'verify_recovery') await verifyRecovery(job)
    else throw new Error(`Unknown job kind: ${job.kind}`)
    await completeJob(job)
  } catch (err) {
    await retryJob(job, err)
    console.error(`[worker] job ${job.id} failed:`, err.message)
  }
  return true
}

async function runWorker() {
  console.log(`[worker] ${workerId} started`)
  while (true) {
    try { if (!await runOnce()) await new Promise(resolve => setTimeout(resolve, pollMs)) }
    catch (err) { console.error('[worker] loop failure:', err.message); await new Promise(resolve => setTimeout(resolve, pollMs)) }
  }
}

if (require.main === module) runWorker().catch(err => { console.error(err); process.exit(1) })
module.exports = { claimJob, signature, runOnce, dispatchRecovery }
