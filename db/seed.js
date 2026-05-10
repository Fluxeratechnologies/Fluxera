// db/seed.js
// Creates a test customer and seeds 24h of fake API logs
// Run: node db/seed.js
// USE IN DEVELOPMENT ONLY

require('dotenv').config()
const { query, pool } = require('./pool')
const crypto = require('crypto')

const ENDPOINTS = [
  { path: '/v1/chat/completions', price: 0.06, weight: 0.4 },
  { path: '/v1/completions',      price: 0.04, weight: 0.3 },
  { path: '/v1/embeddings',       price: 0.01, weight: 0.2 },
  { path: '/v1/images/generate',  price: 0.08, weight: 0.1 },
]
const ERRORS     = ['timeout', 'rate_limit', 'server_error', 'context_length']
const FAIL_RATE  = 0.18  // 18% failure rate
const LOG_COUNT  = 2000  // logs to generate

function pick(arr, weights) {
  const r = Math.random()
  let acc = 0
  for (let i = 0; i < arr.length; i++) {
    acc += weights ? weights[i] : 1 / arr.length
    if (r <= acc) return arr[i]
  }
  return arr[arr.length - 1]
}

async function seed() {
  console.log('Seeding development data...\n')

  // Create test customer
  const apiKey = 'fx_test_' + crypto.randomBytes(16).toString('hex')
  const custResult = await query(`
    INSERT INTO customers (email, company, api_key, plan, price_default)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO UPDATE SET api_key = EXCLUDED.api_key
    RETURNING id, api_key
  `, ['test@example.com', 'Acme API Corp', apiKey, 'free', 0.04])

  const customerId = custResult.rows[0].id
  const customerKey = custResult.rows[0].api_key
  console.log(`✓ Customer: test@example.com`)
  console.log(`✓ API Key:  ${customerKey}\n`)

  // Generate logs
  const logs = []
  const now  = Date.now()

  for (let i = 0; i < LOG_COUNT; i++) {
    const ep      = pick(ENDPOINTS, ENDPOINTS.map(e => e.weight))
    const isFail  = Math.random() < FAIL_RATE
    const logTime = new Date(now - Math.random() * 86400000) // last 24h

    logs.push([
      customerId,
      'req_' + crypto.randomBytes(8).toString('hex'),
      ep.path,
      isFail ? 'fail' : 'success',
      isFail
        ? Math.round(800 + Math.random() * 5200)
        : Math.round(60 + Math.random() * 380),
      ep.price * (0.85 + Math.random() * 0.3),
      isFail ? ERRORS[Math.floor(Math.random() * ERRORS.length)] : null,
      logTime,
    ])
  }

  // Batch insert in chunks of 100
  let inserted = 0
  for (let i = 0; i < logs.length; i += 100) {
    const chunk = logs.slice(i, i + 100)
    const placeholders = chunk.map((_, j) => {
      const b = j * 8
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`
    }).join(',')
    const params = chunk.flat()
    await query(
      `INSERT INTO request_logs
         (customer_id, request_id, endpoint, status, latency_ms, price, error_type, logged_at)
       VALUES ${placeholders}
       ON CONFLICT DO NOTHING`,
      params
    )
    inserted += chunk.length
    process.stdout.write(`\r  Inserting logs... ${inserted}/${logs.length}`)
  }

  // Calculate what was seeded
  const failed = logs.filter(l => l[3] === 'fail')
  const totalLost = failed.reduce((sum, l) => sum + l[5], 0)
  const failRate  = (failed.length / logs.length * 100).toFixed(1)

  console.log(`\n\n✓ Seeded ${LOG_COUNT} logs`)
  console.log(`  Failures:     ${failed.length} (${failRate}%)`)
  console.log(`  Revenue lost: $${totalLost.toFixed(2)}`)
  console.log(`\nNow run the processor:`)
  console.log(`  node backend/processor/run.js`)
  console.log(`\nOr test the report API:`)
  console.log(`  curl http://localhost:3000/api/report -H "Authorization: Bearer ${customerKey}"`)

  await pool.end()
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
