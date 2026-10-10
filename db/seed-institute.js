// Seed leak + intelligence data onto an existing institute.
// Usage: node db/seed-institute.js fx_…

require('dotenv').config()
const { randomUUID } = require('crypto')
const { query, pool } = require('./pool')
const { upsertWorkflow, upsertTool, upsertExecution, upsertStep, applyCheckpoint } = require('../backend/intelligence/upsert')
const { rollupExecution } = require('../backend/intelligence/rollup')
const { diagnoseExecution } = require('../backend/intelligence/diagnose')

const ENDPOINTS = [
  { path: '/v1/chat/completions', price: 0.06, weight: 0.4 },
  { path: '/v1/completions', price: 0.04, weight: 0.3 },
  { path: '/v1/embeddings', price: 0.01, weight: 0.2 },
  { path: '/v1/images/generate', price: 0.08, weight: 0.1 },
]
const ERRORS = ['timeout', 'rate_limit', 'server_error', 'context_length']

function pick(arr, weights) {
  const r = Math.random()
  let acc = 0
  for (let i = 0; i < arr.length; i++) {
    acc += weights ? weights[i] : 1 / arr.length
    if (r <= acc) return arr[i]
  }
  return arr[arr.length - 1]
}

async function insertLeaf(customerId, { executionId, stepId, toolId, endpoint, status, latency, price, error, attempt, at, costKind }) {
  await query(
    `INSERT INTO request_logs
       (customer_id, request_id, endpoint, status, latency_ms, price, error_type,
        execution_id, step_id, tool_id, attempt, logged_at, cost_kind)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [customerId, 'req_' + randomUUID().slice(0, 16), endpoint, status, latency, price, error || null,
     executionId, stepId, toolId, attempt || 1, at || new Date(), costKind || 'api']
  )
}

async function seedLeak(customerId) {
  const logs = []
  const now = Date.now()
  for (let i = 0; i < 400; i++) {
    const ep = pick(ENDPOINTS, ENDPOINTS.map(e => e.weight))
    const isFail = Math.random() < 0.18
    logs.push([
      customerId,
      'req_' + randomUUID().slice(0, 16),
      ep.path,
      isFail ? 'fail' : 'success',
      isFail ? Math.round(800 + Math.random() * 5200) : Math.round(60 + Math.random() * 380),
      ep.price * (0.85 + Math.random() * 0.3),
      isFail ? ERRORS[Math.floor(Math.random() * ERRORS.length)] : null,
      new Date(now - Math.random() * 86400000),
    ])
  }
  for (let i = 0; i < logs.length; i += 100) {
    const chunk = logs.slice(i, i + 100)
    const placeholders = chunk.map((_, j) => {
      const b = j * 8
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`
    }).join(',')
    await query(
      `INSERT INTO request_logs
         (customer_id, request_id, endpoint, status, latency_ms, price, error_type, logged_at)
       VALUES ${placeholders}
       ON CONFLICT DO NOTHING`,
      chunk.flat()
    )
  }
}

async function seedCheckout(customer) {
  const customerId = customer.id
  const workflowId = await upsertWorkflow(customerId, 'checkout')
  const inventory = await upsertTool(customerId, 'inventory', 0.01)
  const stripe = await upsertTool(customerId, 'stripe', 0.02)
  const notify = await upsertTool(customerId, 'notify', 0.005)
  const scenarios = [
    {
      label: 'success', agoMs: 3600000, durationMs: 420,
      steps: [
        { name: 'reserve', status: 'success', duration: 80, leaves: [{ tool: inventory, endpoint: 'inventory', status: 'success', price: 0.01, latency: 70, costKind: 'tool' }] },
        { name: 'charge', status: 'success', duration: 200, leaves: [{ tool: stripe, endpoint: 'stripe', status: 'success', price: 0.02, latency: 180, costKind: 'tool' }] },
        { name: 'notify', status: 'success', duration: 40, leaves: [{ tool: notify, endpoint: 'notify', status: 'success', price: 0.005, latency: 30, costKind: 'tool' }] },
      ],
    },
    {
      label: 'partial', agoMs: 1800000, durationMs: 3100,
      steps: [
        { name: 'reserve', status: 'success', duration: 90, leaves: [{ tool: inventory, endpoint: 'inventory', status: 'success', price: 0.01, latency: 80, costKind: 'tool' }] },
        { name: 'charge', status: 'fail', duration: 2800, leaves: [
          { tool: stripe, endpoint: 'stripe', status: 'fail', price: 0.02, latency: 1200, error: 'timeout', attempt: 1, costKind: 'tool' },
          { tool: stripe, endpoint: 'stripe', status: 'fail', price: 0.02, latency: 1400, error: 'timeout', attempt: 2, costKind: 'tool' },
        ]},
        { name: 'notify', status: 'success', duration: 50, leaves: [{ tool: notify, endpoint: 'notify', status: 'success', price: 0.005, latency: 40, costKind: 'tool' }] },
      ],
    },
    {
      label: 'failed', agoMs: 600000, durationMs: 900,
      steps: [
        { name: 'reserve', status: 'fail', duration: 800, leaves: [{ tool: inventory, endpoint: 'inventory', status: 'fail', price: 0.01, latency: 780, error: 'rate_limit', costKind: 'tool' }] },
        { name: 'charge', depends_on: ['reserve'], status: 'fail', duration: 200, leaves: [{ tool: stripe, endpoint: 'stripe', status: 'fail', price: 0.02, latency: 180, error: 'timeout', costKind: 'tool' }] },
      ],
    },
  ]
  for (const sc of scenarios) {
    const executionId = randomUUID()
    const started = new Date(Date.now() - sc.agoMs)
    await upsertExecution(customerId, {
      id: executionId, workflowId, startedAt: started,
      endedAt: new Date(started.getTime() + sc.durationMs),
      status: 'success', durationMs: sc.durationMs,
    })
    let t = started.getTime()
    const stepIds = {}
    for (const st of sc.steps) {
      const stepId = randomUUID()
      stepIds[st.name] = stepId
      await upsertStep(customerId, {
        id: stepId, executionId, parentStepId: st.parent ? stepIds[st.parent] : null,
        name: st.name, status: st.status, startedAt: new Date(t),
        endedAt: new Date(t + st.duration), durationMs: st.duration, dependsOn: st.depends_on,
      })
      for (const leaf of st.leaves) {
        await insertLeaf(customerId, {
          executionId, stepId, toolId: leaf.tool, endpoint: leaf.endpoint,
          status: leaf.status, latency: leaf.latency, price: leaf.price,
          error: leaf.error, attempt: leaf.attempt || 1, at: new Date(t), costKind: leaf.costKind,
        })
      }
      t += st.duration
    }
    await rollupExecution(executionId)
    await diagnoseExecution(customer, executionId)
    console.log(`  checkout ${sc.label}`)
  }
}

async function seedInterruptedResume(customer) {
  const customerId = customer.id
  const workflowId = await upsertWorkflow(customerId, 'ingest-docs')
  const embed = await upsertTool(customerId, 'embeddings', 0.008)
  const store = await upsertTool(customerId, 'vector-db', 0.003)

  const originalId = randomUUID()
  const started = new Date(Date.now() - 40 * 60 * 1000)
  await upsertExecution(customerId, {
    id: originalId, workflowId, startedAt: started, endedAt: null, status: 'success',
  })
  const loadId = randomUUID()
  const indexId = randomUUID()
  await upsertStep(customerId, {
    id: loadId, executionId: originalId, name: 'load', status: 'success',
    startedAt: started, endedAt: new Date(started.getTime() + 4000), durationMs: 4000,
  })
  await insertLeaf(customerId, {
    executionId: originalId, stepId: loadId, toolId: store, endpoint: 's3',
    status: 'success', latency: 3800, price: 5, at: started, costKind: 'compute',
  })
  await upsertStep(customerId, {
    id: indexId, executionId: originalId, name: 'index', status: 'success',
    startedAt: new Date(started.getTime() + 4000), endedAt: null, durationMs: null,
  })
  await insertLeaf(customerId, {
    executionId: originalId, stepId: indexId, toolId: embed, endpoint: 'embed',
    status: 'success', latency: 900, price: 12, at: new Date(started.getTime() + 20000), costKind: 'api',
  })
  await insertLeaf(customerId, {
    executionId: originalId, stepId: indexId, toolId: embed, endpoint: 'embed-model',
    status: 'success', latency: 1100, price: 8, at: new Date(started.getTime() + 25000), costKind: 'model',
  })
  await insertLeaf(customerId, {
    executionId: originalId, stepId: indexId, toolId: store, endpoint: 'upsert-vectors',
    status: 'success', latency: 400, price: 5, at: new Date(started.getTime() + 30000), costKind: 'tool',
  })
  await insertLeaf(customerId, {
    executionId: originalId, stepId: indexId, toolId: store, endpoint: 'worker-cpu',
    status: 'success', latency: 2000, price: 10, at: new Date(started.getTime() + 35000), costKind: 'compute',
  })
  await applyCheckpoint(customerId, {
    stepId: indexId, executionId: originalId, name: 'index',
    cursor: 'doc:67000', progressDone: 67000, progressTotal: 100000,
  })
  await query(
    `UPDATE execution_steps SET ended_at = NULL, checkpoint_at = now() - interval '20 minutes' WHERE id = $1`,
    [indexId]
  )
  await rollupExecution(originalId)
  await diagnoseExecution(customer, originalId)
  await query(
    `INSERT INTO recovery_actions
       (customer_id, execution_id, step_id, kind, action, executed, result)
     VALUES ($1, $2, $3, 'executed', 'resume', 'webhook', '200')`,
    [customerId, originalId, indexId]
  )

  const childId = randomUUID()
  const childStart = new Date(Date.now() - 8 * 60 * 1000)
  await upsertExecution(customerId, {
    id: childId, workflowId, startedAt: childStart,
    endedAt: new Date(childStart.getTime() + 12000),
    status: 'success', durationMs: 12000, recoveryOf: originalId,
  })
  const childStep = randomUUID()
  await upsertStep(customerId, {
    id: childStep, executionId: childId, name: 'index', status: 'success',
    startedAt: childStart, endedAt: new Date(childStart.getTime() + 12000), durationMs: 12000,
  })
  await insertLeaf(customerId, {
    executionId: childId, stepId: childStep, toolId: embed, endpoint: 'embed',
    status: 'success', latency: 400, price: 4, at: childStart, costKind: 'api',
  })
  await insertLeaf(customerId, {
    executionId: childId, stepId: childStep, toolId: store, endpoint: 'worker-cpu',
    status: 'success', latency: 800, price: 3, at: childStart, costKind: 'compute',
  })
  await rollupExecution(childId)
  await diagnoseExecution(customer, originalId)
  console.log('  ingest-docs interrupted + resume (cost avoided)')
}

async function seed() {
  const apiKey = String(process.argv[2] || '').trim()
  if (!apiKey.startsWith('fx_')) {
    console.error('Usage: node db/seed-institute.js fx_…')
    process.exit(1)
  }
  const cust = await query(
    `UPDATE customers
       SET abandonment_rate = 40, avg_order_value = 85
     WHERE api_key = $1 AND active = true
     RETURNING id, email, company, api_key, abandonment_rate, avg_order_value, interrupt_after_minutes`,
    [apiKey]
  )
  if (!cust.rows.length) {
    console.error('No institute for that key.')
    process.exit(1)
  }
  const customer = cust.rows[0]
  console.log(`Seeding ${customer.company || customer.email}`)
  await seedLeak(customer.id)
  console.log('  leak logs')
  await seedCheckout(customer)
  await seedInterruptedResume(customer)
  console.log('Done. Sign in with that institute key and open Workflows / Executions.')
  await pool.end()
}

seed().catch(err => {
  console.error('Seed institute failed:', err)
  process.exit(1)
})
