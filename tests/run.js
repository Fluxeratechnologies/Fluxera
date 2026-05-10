// tests/run.js
// Integration tests for Fluxera V1
// Run: node tests/run.js (with server running on localhost:3000)

require('dotenv').config()
const assert = require('assert')

const BASE_URL  = process.env.TEST_URL || 'http://localhost:3000'
const TEST_KEY  = process.env.TEST_API_KEY || 'fx_test_key_for_testing'

let passed = 0
let failed = 0

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

async function get(path, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  return { status: res.status, body: await res.json() }
}

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`)
    failed++
  }
}

async function run() {
  console.log('\nFluxera V1 — Integration Tests')
  console.log(`Base URL: ${BASE_URL}\n`)

  // ── HEALTH ──────────────────────────────────────────────────
  console.log('Health Check')
  await test('GET /health returns 200', async () => {
    const r = await get('/health')
    assert.strictEqual(r.status, 200)
    assert.strictEqual(r.body.ok, true)
    assert.strictEqual(r.body.db, 'connected')
  })

  // ── AUTH ────────────────────────────────────────────────────
  console.log('\nAuthentication')
  await test('Rejects missing API key', async () => {
    const r = await post('/api/ingest', { logs: [] })
    assert.strictEqual(r.status, 401)
  })

  await test('Rejects invalid API key format', async () => {
    const r = await post('/api/ingest', { logs: [] }, { Authorization: 'Bearer bad_key' })
    assert.strictEqual(r.status, 401)
  })

  // ── INGEST ──────────────────────────────────────────────────
  console.log('\nIngest API')
  await test('Accepts valid log batch', async () => {
    const r = await post('/api/ingest', {
      logs: [
        { endpoint: '/v1/generate', status: 'fail',    latency_ms: 4200, price: 0.04, error_type: 'timeout' },
        { endpoint: '/v1/generate', status: 'success', latency_ms: 310,  price: 0.04 },
        { endpoint: '/v1/embed',    status: 'fail',    latency_ms: 2100, price: 0.01, error_type: 'rate_limit' },
      ]
    }, { Authorization: `Bearer ${TEST_KEY}` })
    assert.strictEqual(r.status, 200)
    assert.strictEqual(r.body.ok, true)
    assert(r.body.accepted >= 0)
  })

  await test('Rejects empty logs array', async () => {
    const r = await post('/api/ingest', { logs: [] }, { Authorization: `Bearer ${TEST_KEY}` })
    assert.strictEqual(r.status, 400)
  })

  await test('Rejects batch over 500', async () => {
    const logs = Array.from({ length: 501 }, (_, i) => ({
      endpoint: '/test', status: 'success', price: 0.01
    }))
    const r = await post('/api/ingest', { logs }, { Authorization: `Bearer ${TEST_KEY}` })
    assert.strictEqual(r.status, 400)
  })

  await test('Handles invalid status gracefully', async () => {
    const r = await post('/api/ingest', {
      logs: [{ endpoint: '/test', status: 'invalid_status', price: 0.01 }]
    }, { Authorization: `Bearer ${TEST_KEY}` })
    // Should either reject or accept 0 (invalid entries go to rejected)
    assert([200, 400].includes(r.status))
  })

  // ── REPORT ──────────────────────────────────────────────────
  console.log('\nReport API')
  await test('Returns report for authenticated customer', async () => {
    const r = await get('/api/report', { Authorization: `Bearer ${TEST_KEY}` })
    assert.strictEqual(r.status, 200)
    assert(typeof r.body.revenue_lost === 'number')
    assert(typeof r.body.summary === 'object')
    assert(Array.isArray(r.body.endpoints))
  })

  await test('Returns report for 7d period', async () => {
    const r = await get('/api/report?period=7d', { Authorization: `Bearer ${TEST_KEY}` })
    assert.strictEqual(r.status, 200)
    assert.strictEqual(r.body.period, '7d')
  })

  await test('Revenue lost is non-negative', async () => {
    const r = await get('/api/report', { Authorization: `Bearer ${TEST_KEY}` })
    assert(r.body.revenue_lost >= 0)
  })

  await test('Calculation transparency is included', async () => {
    const r = await get('/api/report', { Authorization: `Bearer ${TEST_KEY}` })
    assert(r.body.calculation)
    assert(r.body.calculation.formula === 'failed_requests × avg_price_per_request')
  })

  // ── CORE FORMULA ─────────────────────────────────────────────
  console.log('\nCore Formula Verification')
  await test('lost_revenue = failed_requests × avg_price', async () => {
    const r = await get('/api/report', { Authorization: `Bearer ${TEST_KEY}` })
    const { failed_requests, revenue_lost } = r.body.summary
    const { avg_price } = r.body.calculation
    if (failed_requests > 0) {
      const computed = failed_requests * avg_price
      const diff = Math.abs(computed - revenue_lost)
      // Allow small floating point difference
      assert(diff < 0.01, `Formula mismatch: ${failed_requests} × ${avg_price} = ${computed}, reported ${revenue_lost}`)
    }
  })

  // ── WAITLIST ─────────────────────────────────────────────────
  console.log('\nWaitlist')
  await test('Accepts valid email', async () => {
    const r = await post('/api/waitlist', { email: `test${Date.now()}@example.com`, company: 'Test Co' })
    assert.strictEqual(r.status, 200)
    assert.strictEqual(r.body.ok, true)
  })

  await test('Rejects invalid email', async () => {
    const r = await post('/api/waitlist', { email: 'notanemail' })
    assert.strictEqual(r.status, 400)
  })

  // ── SUMMARY ──────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.log('\n⚠ Some tests failed. Check your setup.')
    process.exit(1)
  } else {
    console.log('\n✓ All tests passed. Fluxera V1 is working.\n')
  }
}

run().catch(err => {
  console.error('Test runner error:', err.message)
  process.exit(1)
})
