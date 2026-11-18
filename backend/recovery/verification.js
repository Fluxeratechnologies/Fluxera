const { query } = require('../../db/pool')
const { publishWorkspaceEvent } = require('../events/publish')

async function verifyRecoveryExecution(customerId, executionId, recoveryRequestId = null) {
  const found = await query(
    `SELECT e.id, e.status, e.ended_at, e.recovery_request_id, e.recovery_of
     FROM workflow_executions e
     WHERE e.id = $1 AND e.customer_id = $2`,
    [executionId, customerId]
  )
  const execution = found.rows[0]
  if (!execution || !execution.ended_at) return null

  const requestId = recoveryRequestId || execution.recovery_request_id
  if (!requestId) return null
  const status = execution.status === 'success' ? 'verified' : 'verification_failed'
  const updated = await query(
    `UPDATE recovery_requests
     SET status = $3, verification_execution_id = $4, verified_at = now(), updated_at = now()
     WHERE id = $1 AND customer_id = $2 AND status IN ('dispatched', 'delivery_failed')
       AND execution_id = $5
     RETURNING *`,
    [requestId, customerId, status, execution.id, execution.recovery_of]
  )
  const request = updated.rows[0]
  if (!request) return null
  await query(
    `INSERT INTO recovery_audit_events (recovery_request_id, customer_id, event_type, details)
     VALUES ($1, $2, $3, $4)`,
    [request.id, customerId, status, JSON.stringify({ verification_execution_id: execution.id })]
  )
  await publishWorkspaceEvent(customerId, `recovery.${status}`, {
    recovery_request_id: request.id,
    execution_id: execution.id,
  })
  return request
}

module.exports = { verifyRecoveryExecution }
