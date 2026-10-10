const { query } = require('../../db/pool')
const { normalizeDependsOn } = require('./cascade')
const { normalizeActor } = require('./kinds')

async function upsertWorkflow(customerId, name, actor) {
  const result = await query(
    `INSERT INTO workflows (customer_id, name, actor)
     VALUES ($1, $2, $3)
     ON CONFLICT (customer_id, name) DO UPDATE SET
       actor = CASE
         WHEN workflows.actor = 'workflow' AND EXCLUDED.actor IN ('agent', 'memory')
           THEN EXCLUDED.actor
         ELSE workflows.actor
       END -- keep in sync with nextActor()
     RETURNING id`,
    [customerId, String(name).slice(0, 255), normalizeActor(actor)]
  )
  return result.rows[0].id
}

async function upsertTool(customerId, name, price) {
  const result = await query(
    `INSERT INTO tools (customer_id, name, price_default)
     VALUES ($1, $2, $3)
     ON CONFLICT (customer_id, name) DO UPDATE
       SET price_default = COALESCE(EXCLUDED.price_default, tools.price_default)
     RETURNING id`,
    [customerId, String(name).slice(0, 255), Number.isFinite(price) ? price : null]
  )
  return result.rows[0].id
}

async function upsertExecution(customerId, { id, workflowId, startedAt, endedAt, status, durationMs, recoveryOf, forExecutionId, forStep, hitCount }) {
  const hits = Number.isInteger(hitCount) ? hitCount : null
  const result = await query(
    `INSERT INTO workflow_executions
       (id, customer_id, workflow_id, status, started_at, ended_at, duration_ms, recovery_of,
        for_execution_id, for_step, hit_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         ended_at    = COALESCE(EXCLUDED.ended_at, workflow_executions.ended_at),
         duration_ms = COALESCE(EXCLUDED.duration_ms, workflow_executions.duration_ms),
         recovery_of = COALESCE(workflow_executions.recovery_of, EXCLUDED.recovery_of),
         for_execution_id = COALESCE(workflow_executions.for_execution_id, EXCLUDED.for_execution_id),
         for_step = COALESCE(workflow_executions.for_step, EXCLUDED.for_step),
         hit_count = COALESCE(EXCLUDED.hit_count, workflow_executions.hit_count)
     RETURNING id`,
    [
      id,
      customerId,
      workflowId,
      status || 'success',
      startedAt || new Date(),
      endedAt || null,
      durationMs == null ? null : durationMs,
      recoveryOf || null,
      forExecutionId || null,
      forStep || null,
      hits,
    ]
  )
  return result.rows[0].id
}

async function upsertStep(customerId, { id, executionId, parentStepId, name, status, startedAt, endedAt, durationMs, dependsOn }) {
  const depends = normalizeDependsOn(dependsOn)
  const result = await query(
    `INSERT INTO execution_steps
       (id, customer_id, execution_id, parent_step_id, name, status, started_at, ended_at, duration_ms, depends_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       status      = COALESCE(EXCLUDED.status, execution_steps.status),
       ended_at    = COALESCE(EXCLUDED.ended_at, execution_steps.ended_at),
       duration_ms = COALESCE(EXCLUDED.duration_ms, execution_steps.duration_ms),
       depends_on  = CASE WHEN EXCLUDED.depends_on <> '{}' THEN EXCLUDED.depends_on ELSE execution_steps.depends_on END
     RETURNING id`,
    [
      id,
      customerId,
      executionId,
      parentStepId || null,
      String(name).slice(0, 255),
      status === 'fail' ? 'fail' : 'success',
      startedAt || new Date(),
      endedAt || null,
      durationMs == null ? null : durationMs,
      depends,
    ]
  )
  return result.rows[0].id
}

async function applyCheckpoint(customerId, { stepId, executionId, name, cursor, progressDone, progressTotal }) {
  if (!stepId || !executionId) return null
  const done = Number.isInteger(progressDone) ? progressDone : null
  const total = Number.isInteger(progressTotal) ? progressTotal : null
  const token = cursor != null && String(cursor) !== '' ? String(cursor).slice(0, 4096) : null
  const result = await query(
    `INSERT INTO execution_steps
       (id, customer_id, execution_id, name, status, cursor, progress_done, progress_total, checkpoint_at)
     VALUES ($1, $2, $3, $4, 'success', $5, $6, $7, now())
     ON CONFLICT (id) DO UPDATE SET
       cursor = EXCLUDED.cursor,
       progress_done = EXCLUDED.progress_done,
       progress_total = EXCLUDED.progress_total,
       checkpoint_at = now()
     RETURNING id`,
    [stepId, customerId, executionId, String(name || 'step').slice(0, 255), token, done, total]
  )
  return result.rows[0].id
}

async function resolveRecoveryOf(customerId, recoveryOf) {
  if (!recoveryOf) return null
  const result = await query(
    `SELECT id FROM workflow_executions WHERE id = $1 AND customer_id = $2`,
    [recoveryOf, customerId]
  )
  return result.rows[0]?.id || null
}

async function resolveForAgent(customerId, forExecutionId) {
  if (!forExecutionId) return null
  const result = await query(
    `SELECT e.id
     FROM workflow_executions e
     JOIN workflows w ON w.id = e.workflow_id
     WHERE e.id = $1 AND e.customer_id = $2 AND w.actor = 'agent'`,
    [forExecutionId, customerId]
  )
  return result.rows[0]?.id || null
}

module.exports = { upsertWorkflow, upsertTool, upsertExecution, upsertStep, applyCheckpoint, resolveRecoveryOf, resolveForAgent }
