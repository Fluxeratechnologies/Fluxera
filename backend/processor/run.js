// backend/processor/run.js
// THE CORE ENGINE OF FLUXERA
//
// Runs every hour (via cron in server.js)
// For each customer:
//   1. Pull raw logs for the last hour
//   2. Count failures per endpoint
//   3. Apply: lost_revenue = failed_requests × avg_price
//   4. Write revenue_report to DB
//
// This is the only place the core formula runs.
// Keep it simple. Keep it correct.

const { query } = require('../../db/pool')

async function runProcessor() {
  const periodEnd   = new Date()
  const periodStart = new Date(periodEnd.getTime() - 60 * 60 * 1000) // last hour

  console.log(`[processor] Period: ${periodStart.toISOString()} → ${periodEnd.toISOString()}`)

  // Get all customers who sent logs in this period
  const activeResult = await query(`
    SELECT DISTINCT customer_id
    FROM request_logs
    WHERE logged_at >= $1 AND logged_at < $2
  `, [periodStart, periodEnd])

  const customerIds = activeResult.rows.map(r => r.customer_id)
  console.log(`[processor] Active customers: ${customerIds.length}`)

  let processed = 0
  let errors    = 0

  for (const customerId of customerIds) {
    try {
      await processCustomer(customerId, periodStart, periodEnd)
      processed++
    } catch (err) {
      console.error(`[processor] Failed for ${customerId}:`, err.message)
      errors++
    }
  }

  console.log(`[processor] Done — ${processed} processed, ${errors} errors`)
  return { processed, errors, period: { start: periodStart, end: periodEnd } }
}

async function processCustomer(customerId, periodStart, periodEnd) {
  // Pull all logs for this customer in the period
  const logsResult = await query(`
    SELECT endpoint, status, price, latency_ms, error_type
    FROM request_logs
    WHERE customer_id = $1
      AND logged_at  >= $2
      AND logged_at   < $3
  `, [customerId, periodStart, periodEnd])

  const logs = logsResult.rows
  if (!logs.length) return

  // ─────────────────────────────────────────────────────────────
  // CORE FORMULA: lost_revenue = failed_requests × avg_price
  // ─────────────────────────────────────────────────────────────

  const totalRequests  = logs.length
  const failedLogs     = logs.filter(l => l.status === 'fail')
  const failedRequests = failedLogs.length
  const failureRate    = (failedRequests / totalRequests) * 100

  // Sum actual prices of each failed call (more accurate than avg × count)
  const revenueLost = failedLogs.reduce((sum, l) => sum + parseFloat(l.price || 0), 0)

  // Group by endpoint
  const byEndpoint = {}
  for (const log of logs) {
    if (!byEndpoint[log.endpoint]) {
      byEndpoint[log.endpoint] = {
        total: 0, failed: 0, revenue_lost: 0, latencies: [], errors: {}
      }
    }
    const ep = byEndpoint[log.endpoint]
    ep.total++
    if (log.latency_ms) ep.latencies.push(log.latency_ms)
    if (log.status === 'fail') {
      ep.failed++
      ep.revenue_lost += parseFloat(log.price || 0)
      const errKey = log.error_type || 'unknown'
      ep.errors[errKey] = (ep.errors[errKey] || 0) + 1
    }
  }

  // Rank endpoints by revenue lost
  const breakdown = Object.entries(byEndpoint)
    .map(([endpoint, s]) => ({
      endpoint,
      total:          s.total,
      failed:         s.failed,
      failure_rate:   s.total > 0 ? Math.round((s.failed / s.total) * 10000) / 100 : 0,
      revenue_lost:   Math.round(s.revenue_lost * 10000) / 10000,
      avg_latency_ms: s.latencies.length
        ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length)
        : null,
      top_error: Object.entries(s.errors).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }))
    .sort((a, b) => b.revenue_lost - a.revenue_lost)

  const topEndpoint = breakdown[0] || null

  // Write report (upsert — safe to run multiple times)
  await query(`
    INSERT INTO revenue_reports
      (customer_id, period_start, period_end, total_requests, failed_requests,
       failure_rate, revenue_lost, top_endpoint, top_endpoint_loss, breakdown)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (customer_id, period_start)
    DO UPDATE SET
      total_requests    = EXCLUDED.total_requests,
      failed_requests   = EXCLUDED.failed_requests,
      failure_rate      = EXCLUDED.failure_rate,
      revenue_lost      = EXCLUDED.revenue_lost,
      top_endpoint      = EXCLUDED.top_endpoint,
      top_endpoint_loss = EXCLUDED.top_endpoint_loss,
      breakdown         = EXCLUDED.breakdown,
      computed_at       = now()
  `, [
    customerId,
    periodStart,
    periodEnd,
    totalRequests,
    failedRequests,
    Math.round(failureRate * 100) / 100,
    Math.round(revenueLost * 10000) / 10000,
    topEndpoint?.endpoint || null,
    topEndpoint?.revenue_lost || 0,
    JSON.stringify(breakdown),
  ])

  console.log(`[processor] ${customerId}: ${failedRequests}/${totalRequests} failed → $${revenueLost.toFixed(4)} lost`)
}

module.exports = { runProcessor, processCustomer }
