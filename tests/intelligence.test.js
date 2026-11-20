const assert = require('assert')
const { executionStatus } = require('../backend/intelligence/status')
const { costFromLeaves } = require('../backend/intelligence/rollup')
const { diagnosePayload, recommendFrom, mostCommon, resumeCost, pickMemoryMiss, shownStatus } = require('../backend/intelligence/diagnose')
const { tagCascade } = require('../backend/intelligence/cascade')
const { toolAvailability } = require('../backend/intelligence/availability')
const { isLeafKind, nextActor, actorFilter } = require('../backend/intelligence/kinds')
const { canTransition } = require('../backend/recovery/states')
const { signature } = require('../backend/worker/run')
const { configuration: ga4Configuration, rows: ga4Rows } = require('../backend/analytics/ga4')

let passed = 0
let failed = 0
const queue = []

function test(name, fn) {
  queue.push({ name, fn })
}

test('all success → success', () => {
  assert.strictEqual(executionStatus(['success', 'success']), 'success')
})

test('recovery lifecycle permits approval and blocks terminal changes', () => {
  assert.strictEqual(canTransition('pending_approval', 'approved'), true)
  assert.strictEqual(canTransition('pending_approval', 'rejected'), true)
  assert.strictEqual(canTransition('approved', 'dispatching'), true)
  assert.strictEqual(canTransition('dispatched', 'verified'), true)
  assert.strictEqual(canTransition('verified', 'dispatching'), false)
  assert.strictEqual(canTransition('rejected', 'approved'), false)
})

test('recovery webhook signature is stable and timestamp-bound', () => {
  assert.strictEqual(
    signature('secret', '2026-11-17T00:00:00.000Z', '{"recovery_id":"r1"}'),
    'sha256=3600bdb281e4cb607b2f0a923da10ffa4e5bc5c79f7036b01cb6174d60e6b708'
  )
  assert.notStrictEqual(
    signature('secret', '2026-11-17T00:00:01.000Z', '{"recovery_id":"r1"}'),
    signature('secret', '2026-11-17T00:00:00.000Z', '{"recovery_id":"r1"}')
  )
})

test('GA4 reporting stays disabled until every server credential is present', () => {
  assert.strictEqual(ga4Configuration({}).configured, false)
  assert.strictEqual(ga4Configuration({ GA4_PROPERTY_ID: '123', GA4_CLIENT_EMAIL: 'analytics@example.test' }).configured, false)
  assert.strictEqual(ga4Configuration({
    GA4_PROPERTY_ID: 'properties/123',
    GA4_CLIENT_EMAIL: 'analytics@example.test',
    GA4_PRIVATE_KEY: 'private-key',
  }).configured, true)
})

test('GA4 report rows are converted into named numeric values', () => {
  assert.deepStrictEqual(ga4Rows({ rows: [{
    dimensionValues: [{ value: 'try_opened' }],
    metricValues: [{ value: '12' }, { value: '9' }],
  }] }, ['event_name'], ['event_count', 'users']), [{ event_name: 'try_opened', event_count: 12, users: 9 }])
})

test('all fail → failed', () => {
  assert.strictEqual(executionStatus(['fail', 'fail']), 'failed')
})

test('mix → partial', () => {
  assert.strictEqual(executionStatus(['success', 'fail']), 'partial')
})

test('mix cascade → partial', () => {
  assert.strictEqual(executionStatus(['success', 'cascade']), 'partial')
})

test('named depends_on fail → cascade', () => {
  const tagged = tagCascade([
    { id: 's1', name: 'reserve', status: 'fail', depends_on: [] },
    { id: 's2', name: 'charge', status: 'fail', depends_on: ['reserve'] },
  ])
  assert.strictEqual(tagged.find(s => s.name === 'charge').status, 'cascade')
  assert.strictEqual(tagged.find(s => s.name === 'reserve').status, 'fail')
})

test('nested child of failed parent → cascade', () => {
  const tagged = tagCascade([
    { id: 's1', name: 'charge', status: 'fail', parent_step_id: null, depends_on: [] },
    { id: 's2', name: 'authorize', status: 'fail', parent_step_id: 's1', depends_on: [] },
  ])
  assert.strictEqual(tagged.find(s => s.name === 'authorize').status, 'cascade')
})

test('own fail without dep stays fail', () => {
  const tagged = tagCascade([
    { id: 's1', name: 'reserve', status: 'success', depends_on: [] },
    { id: 's2', name: 'charge', status: 'fail', depends_on: ['reserve'] },
  ])
  assert.strictEqual(tagged.find(s => s.name === 'charge').status, 'fail')
})

test('tool down at 5 calls and 50% fail', () => {
  assert.strictEqual(toolAvailability({ calls: 5, failed: 3 }), 'down')
  assert.strictEqual(toolAvailability({ calls: 4, failed: 4 }), 'ok')
  assert.strictEqual(toolAvailability({ calls: 10, failed: 4 }), 'ok')
})

test('cost rollup splits failed vs retry', () => {
  const c = costFromLeaves([
    { price: 0.02, status: 'fail', attempt: 1 },
    { price: 0.02, status: 'fail', attempt: 2 },
    { price: 0.01, status: 'success', attempt: 1 },
  ])
  assert.strictEqual(c.total, 0.05)
  assert.ok(Math.abs(c.failed - 0.04) < 1e-9)
  assert.ok(Math.abs(c.retry - 0.02) < 1e-9)
})

test('timeout after retries → tool_down', () => {
  const rec = recommendFrom({
    failedStep: { name: 'charge' },
    leaves: [{ status: 'fail', error_type: 'timeout', attempt: 2 }],
    retried: true,
    timedOut: true,
  })
  assert.strictEqual(rec.action, 'tool_down')
})

test('timeout without retries → retry', () => {
  const rec = recommendFrom({
    failedStep: { name: 'charge' },
    leaves: [{ status: 'fail', error_type: 'timeout', attempt: 1 }],
    retried: false,
    timedOut: true,
  })
  assert.strictEqual(rec.action, 'retry')
})

test('most common error', () => {
  assert.strictEqual(mostCommon(['timeout', 'timeout', 'rate_limit']), 'timeout')
})

test('diagnose names the failed step and cost', () => {
  const d = diagnosePayload({
    execution: { id: 'e1' },
    workflowName: 'checkout',
    steps: [
      { id: 's1', name: 'reserve', status: 'success', started_at: '2026-01-01T00:00:00Z' },
      { id: 's2', name: 'charge', status: 'fail', started_at: '2026-01-01T00:00:01Z' },
    ],
    leaves: [
      { step_id: 's1', status: 'success', price: 0.01, attempt: 1 },
      { step_id: 's2', status: 'fail', price: 0.02, attempt: 1, error_type: 'timeout' },
    ],
    customer: { abandonment_rate: 0, avg_order_value: 0 },
  })
  assert.strictEqual(d.what_failed.name, 'charge')
  assert.strictEqual(d.why.error_type, 'timeout')
  assert.strictEqual(d.recover.action, 'retry')
  assert.ok(Math.abs(d.cost.failed - 0.02) < 1e-9)
  assert.strictEqual(d.affected.users_affected, null)
})

test('diagnose impact only when abandonment and AOV are set', () => {
  const d = diagnosePayload({
    execution: { id: 'e1' },
    workflowName: 'checkout',
    steps: [{ id: 's1', name: 'charge', status: 'fail', started_at: '2026-01-01T00:00:00Z' }],
    leaves: [
      { step_id: 's1', status: 'fail', price: 0.02, attempt: 1, error_type: 'timeout' },
      { step_id: 's1', status: 'fail', price: 0.02, attempt: 2, error_type: 'timeout' },
      { step_id: 's1', status: 'fail', price: 0.02, attempt: 1, error_type: 'timeout' },
    ],
    customer: { abandonment_rate: 40, avg_order_value: 85 },
  })
  assert.strictEqual(d.affected.users_affected, 1)
  assert.strictEqual(d.affected.revenue_at_risk, 85)
})

test('history groups checkups by workflow', () => {
  // Keep in sync with frontend/src/pages/Executions.jsx groupByWorkflow
  const map=new Map()
  for (const r of [
    { workflow_name: 'checkout', id: 1 },
    { workflow_name: 'refund', id: 2 },
    { workflow_name: 'checkout', id: 3 },
  ]) {
    const k=r.workflow_name
    if(!map.has(k))map.set(k,[])
    map.get(k).push(r)
  }
  const g=[...map.entries()]
  assert.strictEqual(g.length, 2)
  assert.strictEqual(g[0][0], 'checkout')
  assert.strictEqual(g[0][1].length, 2)
  assert.strictEqual(g[1][0], 'refund')
})

test('checkpoint kind is not a leaf', () => {
  assert.strictEqual(isLeafKind('checkpoint'), false)
  assert.strictEqual(isLeafKind('workflow_start'), false)
  assert.strictEqual(isLeafKind('step_end'), false)
  assert.strictEqual(isLeafKind('tool_call'), true)
  assert.strictEqual(isLeafKind('api_call'), true)
  assert.strictEqual(isLeafKind('mystery'), true)
})

test('cursor on failed step recommends resume', () => {
  const d = diagnosePayload({
    execution: { id: 'e1', ended_at: '2026-01-01T00:10:00Z' },
    workflowName: 'ingest',
    steps: [
      { id: 's1', name: 'index', status: 'fail', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:10:00Z', cursor: 'doc:67000', progress_done: 67000, progress_total: 100000 },
    ],
    leaves: [{ step_id: 's1', status: 'fail', price: 40, attempt: 1, error_type: 'timeout' }],
    customer: { interrupt_after_minutes: 15 },
  })
  assert.strictEqual(d.recover.action, 'resume')
  assert.ok(d.recover.reason.includes('67000/100000'))
})

test('no cursor keeps retry', () => {
  const d = diagnosePayload({
    execution: { id: 'e1', ended_at: '2026-01-01T00:10:00Z' },
    workflowName: 'checkout',
    steps: [
      { id: 's1', name: 'charge', status: 'fail', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:10:00Z' },
    ],
    leaves: [{ step_id: 's1', status: 'fail', price: 0.02, attempt: 1, error_type: 'timeout' }],
    customer: {},
  })
  assert.strictEqual(d.recover.action, 'retry')
})

test('failed resume child: recovery cost shown, avoided is 0', () => {
  const c = resumeCost({
    original: 40,
    child: { status: 'failed', total_cost: 7, ended_at: '2026-01-01T00:20:00Z' },
  })
  assert.strictEqual(c.original, 40)
  assert.strictEqual(c.potential_reexecution, 40)
  assert.strictEqual(c.recovery, 7)
  assert.strictEqual(c.avoided, 0)
})

test('successful resume child: avoided is potential minus recovery', () => {
  const c = resumeCost({
    original: 40,
    child: { status: 'success', total_cost: 7, ended_at: '2026-01-01T00:20:00Z' },
  })
  assert.strictEqual(c.recovery, 7)
  assert.strictEqual(c.avoided, 33)
})

test('open resume child leaves recovery and avoided blank', () => {
  const c = resumeCost({
    original: 40,
    child: { status: 'success', total_cost: 0, ended_at: null },
  })
  assert.strictEqual(c.recovery, null)
  assert.strictEqual(c.avoided, null)
})

test('diagnose cost sentence uses latest child', () => {
  const d = diagnosePayload({
    execution: { id: 'e1', ended_at: '2026-01-01T00:10:00Z' },
    workflowName: 'ingest',
    steps: [
      { id: 's1', name: 'index', status: 'fail', started_at: '2026-01-01T00:00:00Z', cursor: 'doc:67', progress_done: 67, progress_total: 100 },
    ],
    leaves: [
      { step_id: 's1', status: 'fail', price: 12, attempt: 1, cost_kind: 'api' },
      { step_id: 's1', status: 'success', price: 8, attempt: 1, cost_kind: 'model' },
    ],
    child: { status: 'success', total_cost: 7, ended_at: '2026-01-01T00:20:00Z' },
    customer: {},
  })
  assert.strictEqual(d.recover.action, 'resume')
  assert.strictEqual(d.cost.original, 20)
  assert.strictEqual(d.cost.potential_reexecution, 20)
  assert.strictEqual(d.cost.recovery, 7)
  assert.strictEqual(d.cost.avoided, 13)
  assert.strictEqual(d.cost.by_kind.api, 12)
  assert.strictEqual(d.cost.by_kind.model, 8)
})

test('new actor is the incoming type, unknown becomes workflow', () => {
  assert.strictEqual(nextActor(null, 'agent'), 'agent')
  assert.strictEqual(nextActor(null, 'memory'), 'memory')
  assert.strictEqual(nextActor(null, 'nope'), 'workflow')
  assert.strictEqual(nextActor(null, undefined), 'workflow')
})

test('workflow may upgrade to agent or memory', () => {
  assert.strictEqual(nextActor('workflow', 'agent'), 'agent')
  assert.strictEqual(nextActor('workflow', 'memory'), 'memory')
})

test('agent and memory do not switch or demote', () => {
  assert.strictEqual(nextActor('agent', 'memory'), 'agent')
  assert.strictEqual(nextActor('memory', 'agent'), 'memory')
  assert.strictEqual(nextActor('agent', 'workflow'), 'agent')
  assert.strictEqual(nextActor('memory', 'workflow'), 'memory')
})

test('actor query accepts only catalog actors', () => {
  assert.strictEqual(actorFilter('agent'), 'agent')
  assert.strictEqual(actorFilter('workflow'), 'workflow')
  assert.strictEqual(actorFilter('memory'), 'memory')
  assert.strictEqual(actorFilter('nope'), null)
  assert.strictEqual(actorFilter(''), null)
  assert.strictEqual(actorFilter(undefined), null)
})

test('agent() stamps actor=agent on workflow_start', () => {
  const { agent } = require('../sdk/node/agent')
  const { workflow } = require('../sdk/node/workflow')
  const events = []
  const pending = agent({ _enqueue(e) { events.push(e) } }, 'sales-agent', async () => 'ok')
  pending.catch(() => {})
  assert.strictEqual(events[0].kind, 'workflow_start')
  assert.strictEqual(events[0].actor, 'agent')
  assert.strictEqual(events[0].workflow, 'sales-agent')
  const plain = []
  workflow({ _enqueue(e) { plain.push(e) } }, 'checkout', async () => {}).catch(() => {})
  assert.strictEqual(plain[0].actor, 'workflow')
  assert.strictEqual(isLeafKind('checkpoint'), false)
})

test('checkpoint() throws outside step()', () => {
  const { checkpoint } = require('../sdk/node/checkpoint')
  assert.throws(() => checkpoint({ _enqueue() {} }, { done: 1 }), /inside step/)
})

test('memory() links only to a parent agent', async () => {
  const { agent } = require('../sdk/node/agent')
  const { memory } = require('../sdk/node/memory')
  const { workflow } = require('../sdk/node/workflow')
  const { step } = require('../sdk/node/step')
  const events = []
  const client = { _enqueue(e) { events.push(e) } }
  await agent(client, 'sales-agent', async () => {
    await memory(client, 'loose', async () => ({ hits: 2 }))
    await step(client, 'qualify', async () => {
      await memory(client, 'customer-kb', async () => ({ hits: 0, docs: [] }))
    })
  })
  const loose = events.find(e => e.kind === 'workflow_start' && e.workflow === 'loose')
  const kb = events.find(e => e.kind === 'workflow_start' && e.workflow === 'customer-kb')
  const kbEnd = events.find(e => e.kind === 'workflow_end' && e.workflow === 'customer-kb')
  assert.strictEqual(loose.actor, 'memory')
  assert.ok(loose.for_execution_id)
  assert.strictEqual(loose.for_step, null)
  assert.strictEqual(kb.for_step, 'qualify')
  assert.strictEqual(kb.for_execution_id, loose.for_execution_id)
  assert.strictEqual(kbEnd.hits, 0)
  assert.strictEqual(kbEnd.hitsBox, undefined)
  const plain = []
  const plainClient = { _enqueue(e) { plain.push(e) } }
  await workflow(plainClient, 'checkout', async () => {
    await memory(plainClient, 'embed-job', async () => ({ hits: 4 }))
  })
  const embed = plain.find(e => e.kind === 'workflow_start' && e.workflow === 'embed-job')
  assert.strictEqual(embed.for_execution_id, null)
  assert.strictEqual(embed.for_step, null)
})

test('memory() keeps opts.hits 0 and ignores a non-numeric return', async () => {
  const { memory } = require('../sdk/node/memory')
  const events = []
  const client = { _enqueue(e) { events.push(e) } }
  await memory(client, 'customer-kb', async () => ({ hits: 3 }), { hits: 0 })
  const end = events.find(e => e.kind === 'workflow_end')
  assert.strictEqual(end.hits, 0)
  const more = []
  await memory({ _enqueue(e) { more.push(e) } }, 'customer-kb', async () => ['doc'])
  assert.strictEqual(more.find(e => e.kind === 'workflow_end').hits, null)
})

test('memory() inside memory does not link to the outer memory run', async () => {
  const { agent } = require('../sdk/node/agent')
  const { memory } = require('../sdk/node/memory')
  const events = []
  const client = { _enqueue(e) { events.push(e) } }
  await agent(client, 'sales-agent', async () => {
    await memory(client, 'outer', async () => {
      await memory(client, 'inner', async () => ({ hits: 1 }))
      return { hits: 1 }
    })
  })
  const outer = events.find(e => e.kind === 'workflow_start' && e.workflow === 'outer')
  const inner = events.find(e => e.kind === 'workflow_start' && e.workflow === 'inner')
  assert.ok(outer.for_execution_id)
  assert.strictEqual(inner.for_execution_id, null)
})

test('pick the latest miss on the failed step', () => {
  const runs = [
    { id: 'old', workflow_name: 'customer-kb', for_step: 'qualify', status: 'success', hit_count: 0, started_at: '2026-01-01T00:00:01Z', total_cost: 1 },
    { id: 'other', workflow_name: 'product-kb', for_step: 'price', status: 'failed', hit_count: null, started_at: '2026-01-01T00:00:09Z', total_cost: 4 },
    { id: 'new', workflow_name: 'customer-kb', for_step: 'qualify', status: 'success', hit_count: 0, started_at: '2026-01-01T00:00:05Z', total_cost: 2 },
  ]
  assert.strictEqual(pickMemoryMiss(runs, 'qualify').id, 'new')
  assert.strictEqual(pickMemoryMiss(runs, 'charge'), null)
  assert.strictEqual(pickMemoryMiss([
    { id: 'bare', workflow_name: 'customer-kb', for_step: null, status: 'success', hit_count: 0, started_at: '2026-01-01T00:00:02Z' },
  ], 'qualify').id, 'bare')
})

test('failed agent names the memory miss and does not fold its cost', () => {
  const d = diagnosePayload({
    execution: { id: 'e1', ended_at: '2026-01-01T00:10:00Z' },
    workflowName: 'sales-agent',
    steps: [
      { id: 's1', name: 'qualify', status: 'fail', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:10:00Z', cursor: 'before-qualify' },
    ],
    leaves: [{ step_id: 's1', status: 'fail', price: 0.02, attempt: 1, error_type: 'timeout' }],
    memoryRuns: [
      { id: 'm1', workflow_name: 'customer-kb', for_step: 'qualify', status: 'success', hit_count: 0, total_cost: 0.01, started_at: '2026-01-01T00:00:01Z' },
    ],
    customer: {},
  })
  assert.strictEqual(d.recover.action, 'resume')
  assert.ok(d.recover.reason.includes('customer-kb missed for step qualify — retry memory, then resume'))
  assert.strictEqual(d.memory.execution_id, 'm1')
  assert.strictEqual(d.cost.linked_memory, 0.01)
  assert.ok(Math.abs(d.cost.total - 0.02) < 1e-9)
})

test('successful agent does not name a memory miss', () => {
  const d = diagnosePayload({
    execution: { id: 'e1', ended_at: '2026-01-01T00:10:00Z' },
    workflowName: 'sales-agent',
    steps: [
      { id: 's1', name: 'qualify', status: 'success', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:10:00Z' },
    ],
    leaves: [],
    memoryRuns: [
      { id: 'm1', workflow_name: 'customer-kb', for_step: 'qualify', status: 'success', hit_count: 0, total_cost: 0.01, started_at: '2026-01-01T00:00:01Z' },
    ],
    customer: {},
  })
  assert.strictEqual(d.memory, null)
  assert.strictEqual(d.recover.action, 'none')
  assert.strictEqual(d.cost.linked_memory, 0.01)
})

test('0-hit memory execution recommends retry', () => {
  const ended = { ended_at: '2026-01-01T00:10:00Z', started_at: '2026-01-01T00:00:00Z' }
  const miss = diagnosePayload({
    execution: { id: 'm1', actor: 'memory', status: 'success', hit_count: 0, ...ended },
    workflowName: 'customer-kb',
    steps: [],
    leaves: [{ status: 'success', price: 0.01, attempt: 1, cost_kind: 'memory' }],
    customer: {},
  })
  assert.strictEqual(miss.recover.action, 'retry')
  assert.ok(miss.recover.reason.includes('0 hits'))
  assert.strictEqual(miss.memory, null)

  const unknown = diagnosePayload({
    execution: { id: 'm2', actor: 'memory', status: 'success', hit_count: null, ...ended },
    workflowName: 'customer-kb',
    steps: [],
    leaves: [],
    customer: {},
  })
  assert.strictEqual(unknown.recover.action, 'none')
})

test('zero-hit memory is a derived miss, a thrown run stays failed', () => {
  assert.strictEqual(shownStatus({ actor: 'memory', status: 'success', hitCount: 0 }), 'miss')
  assert.strictEqual(shownStatus({ actor: 'memory', status: 'failed', hitCount: 0 }), 'failed')
  assert.strictEqual(shownStatus({ actor: 'memory', status: 'success', hitCount: null }), 'success')
  assert.strictEqual(shownStatus({ actor: 'memory', status: 'success', hitCount: 0, interrupted: true }), 'interrupted')
  assert.strictEqual(isLeafKind('checkpoint'), false)
})

async function runTests() {
  console.log('\nIntelligence unit tests\n')
  for (const t of queue) {
    try {
      await t.fn()
      console.log(`  ✓ ${t.name}`)
      passed++
    } catch (err) {
      console.error(`  ✗ ${t.name}: ${err.message}`)
      failed++
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

runTests()
