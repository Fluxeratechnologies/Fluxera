const { randomUUID } = require('crypto')
const { query } = require('../../db/pool')
const { upsertWorkflow, upsertTool, upsertExecution, upsertStep, applyCheckpoint, resolveRecoveryOf, resolveForAgent } = require('./upsert')
const { rollupExecution } = require('./rollup')
const { normalizeCostKind } = require('./kinds')
const { verifyRecoveryExecution } = require('../recovery/verification')
const { publishWorkspaceEvent } = require('../events/publish')

async function applyBatch(customer, events) {
  const executionIds = new Set()
  const leaves = []

  for (const ev of events) {
    // Store only canonical metadata; the ingestion route never passes prompts,
    // responses, tool arguments, or memory values into this record.
    await query(
      `INSERT INTO execution_events (customer_id, request_id, kind, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (customer_id, request_id) DO NOTHING`,
      [customer.id, ev.request_id, ev.kind, JSON.stringify({
        status: ev.status, workflow: ev.workflow, step: ev.step, tool: ev.tool,
        execution_id: ev.execution_id, recovery_of: ev.recovery_of,
        recovery_request_id: ev.recovery_request_id, latency_ms: ev.latency_ms,
        price: ev.price, attempt: ev.attempt, timestamp: ev.ended_at,
      })]
    )
    let toolId = null
    let executionId = ev.execution_id
    let stepId = ev.step_id

    if (ev.workflow) {
      const workflowId = await upsertWorkflow(customer.id, ev.workflow, ev.actor)
      if (!executionId) executionId = randomUUID()
      const ended = ev.kind === 'workflow_end' ? (ev.ended_at || new Date()) : null
      await upsertExecution(customer.id, {
        id: executionId,
        workflowId,
        startedAt: ev.started_at || new Date(),
        endedAt: ended,
        status: ev.status === 'fail' ? 'failed' : 'success',
        durationMs: ev.kind === 'workflow_end' ? ev.latency_ms : null,
        recoveryOf: await resolveRecoveryOf(customer.id, ev.recovery_of),
        recoveryRequestId: ev.recovery_request_id || null,
        forExecutionId: await resolveForAgent(customer.id, ev.for_execution_id),
        forStep: ev.for_step,
        hitCount: ev.hits,
      })
      executionIds.add(executionId)
    }

    if (ev.kind === 'checkpoint' && executionId && stepId) {
      await applyCheckpoint(customer.id, {
        stepId,
        executionId,
        name: ev.step,
        cursor: ev.cursor,
        progressDone: ev.progress_done,
        progressTotal: ev.progress_total,
      })
      executionIds.add(executionId)
    } else if (ev.step && executionId) {
      if (!stepId) stepId = randomUUID()
      await upsertStep(customer.id, {
        id: stepId,
        executionId,
        parentStepId: ev.parent_step_id,
        name: ev.step,
        status: ev.status,
        startedAt: ev.started_at || new Date(),
        endedAt: ev.ended_at || new Date(),
        durationMs: ev.latency_ms,
        dependsOn: ev.depends_on,
      })
      executionIds.add(executionId)
    }

    if (ev.tool) {
      toolId = await upsertTool(customer.id, ev.tool, parseFloat(ev.price) || null)
    }

    if (executionId) executionIds.add(executionId)

    if (ev.isLeaf) {
      leaves.push({
        ...ev,
        execution_id: executionId,
        step_id: stepId,
        tool_id: toolId,
        cost_kind: normalizeCostKind(ev.cost_kind, !!toolId),
      })
    }
  }

  if (leaves.length) {
    const placeholders = leaves.map((_, i) => {
      const b = i * 12
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12})`
    }).join(',')
    const params = leaves.flatMap(l => [
      customer.id,
      l.request_id,
      l.endpoint,
      l.status,
      l.latency_ms,
      l.price,
      l.error_type,
      l.execution_id,
      l.step_id,
      l.tool_id,
      l.attempt,
      l.cost_kind,
    ])
    await query(
      `INSERT INTO request_logs
         (customer_id, request_id, endpoint, status, latency_ms, price, error_type,
          execution_id, step_id, tool_id, attempt, cost_kind)
       VALUES ${placeholders}
       ON CONFLICT (customer_id, request_id) WHERE request_id IS NOT NULL DO NOTHING`,
      params
    )
  }

  for (const id of executionIds) {
    await rollupExecution(id)
    await verifyRecoveryExecution(customer.id, id)
    await publishWorkspaceEvent(customer.id, 'execution.updated', { execution_id: id })
  }
}

module.exports = { applyBatch }
