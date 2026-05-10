// api/processor.js
// GET /api/processor  (called by Vercel Cron every hour)
// 1. Pulls last-hour logs per customer
// 2. Computes: failed × price = lost_revenue
// 3. Groups by endpoint
// 4. Writes revenue_report
// 5. Sends email alert if loss > $0

import { query } from '../lib/db.js'
import { requireCronSecret } from '../lib/auth.js'
import { sendLeakAlert } from '../lib/email.js'

export default async function handler(req, res) {
  if (!requireCronSecret(req, res)) return

  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 60 * 60 * 1000) // last hour

  console.log(`[processor] Running for period: ${periodStart.toISOString()} → ${periodEnd.toISOString()}`)

  try {
    // Get all customers who have logs in this period
    const customersResult = await query(`
      SELECT DISTINCT customer_id FROM request_logs
      WHERE timestamp >= $1 AND timestamp < $2
    `, [periodStart, periodEnd])

    const customerIds = customersResult.rows.map(r => r.customer_id)
    console.log(`[processor] Processing ${customerIds.length} active customers`)

    const reports = []

    for (const customerId of customerIds) {
      // Get all logs for this customer in the period
      const logsResult = await query(`
        SELECT
          endpoint,
          status,
          latency,
          price_per_request
        FROM request_logs
        WHERE customer_id = $1
          AND timestamp >= $2
          AND timestamp < $3
      `, [customerId, periodStart, periodEnd])

      const logs = logsResult.rows
      if (!logs.length) continue

      // ── CORE FORMULA ──────────────────────────────────────────────
      // lost_revenue = failed_requests × avg_price_per_request
      // ──────────────────────────────────────────────────────────────

      const totalRequests = logs.length
      const failedLogs = logs.filter(l => l.status === 'fail')
      const failedRequests = failedLogs.length
      const failureRate = (failedRequests / totalRequests) * 100

      // Group by endpoint
      const byEndpoint = {}
      logs.forEach(log => {
        if (!byEndpoint[log.endpoint]) {
          byEndpoint[log.endpoint] = { total: 0, failed: 0, lost: 0, latencies: [] }
        }
        byEndpoint[log.endpoint].total++
        byEndpoint[log.endpoint].latencies.push(log.latency || 0)
        if (log.status === 'fail') {
          byEndpoint[log.endpoint].failed++
          byEndpoint[log.endpoint].lost += parseFloat(log.price_per_request || 0)
        }
      })

      // Revenue lost = sum of (price_per_request for each failed call)
      const revenueLost = failedLogs.reduce(
        (sum, l) => sum + parseFloat(l.price_per_request || 0), 0
      )

      // Top leaking endpoint
      const endpointBreakdown = Object.entries(byEndpoint)
        .map(([ep, s]) => ({
          endpoint: ep,
          total: s.total,
          failed: s.failed,
          failure_rate: s.total > 0 ? (s.failed / s.total) * 100 : 0,
          revenue_lost: s.lost,
          avg_latency: s.latencies.length
            ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length)
            : 0
        }))
        .sort((a, b) => b.revenue_lost - a.revenue_lost)

      const topEndpoint = endpointBreakdown[0]?.endpoint || null

      // Write report
      const reportResult = await query(`
        INSERT INTO revenue_reports
          (customer_id, period_start, period_end, total_requests, failed_requests,
           failure_rate, revenue_lost, top_endpoint, report_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        customerId,
        periodStart,
        periodEnd,
        totalRequests,
        failedRequests,
        failureRate,
        revenueLost,
        topEndpoint,
        JSON.stringify({ endpoints: endpointBreakdown })
      ])

      const reportId = reportResult.rows[0].id

      reports.push({
        customerId,
        reportId,
        revenueLost,
        failedRequests,
        totalRequests,
        failureRate,
        topEndpoint
      })

      // Send email alert if there's any loss
      if (revenueLost > 0) {
        // Get customer email
        const custResult = await query(
          'SELECT email, company FROM customers WHERE id = $1',
          [customerId]
        )
        const customer = custResult.rows[0]
        if (customer) {
          await sendLeakAlert({
            to: customer.email,
            company: customer.company,
            revenueLost,
            failedRequests,
            totalRequests,
            failureRate,
            topEndpoint,
            endpointBreakdown,
            periodStart,
            periodEnd
          })

          // Log alert sent
          await query(
            `INSERT INTO alerts_sent (customer_id, report_id) VALUES ($1, $2)`,
            [customerId, reportId]
          )
        }
      }
    }

    return res.status(200).json({
      processed: customerIds.length,
      reports: reports.length,
      period: { start: periodStart, end: periodEnd }
    })

  } catch (err) {
    console.error('[processor] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
