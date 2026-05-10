// backend/api/report.js
// GET /api/report
//
// Returns the current revenue loss report for the authenticated customer.
// Customers can hit this to see their numbers on demand.
// Also used by the simple web report page.
//
// Query params:
//   ?period=24h|7d|30d  (default: 24h)

const express           = require('express')
const { query }         = require('../../db/pool')
const { requireAuth }   = require('./auth')

const router = express.Router()

router.get('/', async (req, res) => {
  const customer = await requireAuth(req, res)
  if (!customer) return

  const period = req.query.period || '24h'
  const intervalMap = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' }
  const interval = intervalMap[period] || '24 hours'

  try {
    // Total + failed + revenue lost for the period
    const summaryResult = await query(`
      SELECT
        COUNT(*)                                                   AS total_requests,
        COUNT(*) FILTER (WHERE status = 'fail')                    AS failed_requests,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'fail')::NUMERIC
          / NULLIF(COUNT(*), 0) * 100, 2
        )                                                          AS failure_rate,
        COALESCE(SUM(price) FILTER (WHERE status = 'fail'), 0)    AS revenue_lost,
        ROUND(AVG(latency_ms), 0)                                  AS avg_latency_ms
      FROM request_logs
      WHERE customer_id = $1
        AND logged_at   > now() - INTERVAL '${interval}'
    `, [customer.id])

    // Per-endpoint breakdown
    const endpointResult = await query(`
      SELECT
        endpoint,
        COUNT(*)                                                   AS total,
        COUNT(*) FILTER (WHERE status = 'fail')                    AS failed,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'fail')::NUMERIC
          / COUNT(*) * 100, 2
        )                                                          AS failure_rate,
        COALESCE(SUM(price) FILTER (WHERE status = 'fail'), 0)    AS revenue_lost,
        ROUND(AVG(latency_ms) FILTER (WHERE status = 'fail'), 0)  AS avg_fail_latency_ms,
        MODE() WITHIN GROUP (ORDER BY error_type)                  AS common_error
      FROM request_logs
      WHERE customer_id = $1
        AND logged_at   > now() - INTERVAL '${interval}'
      GROUP BY endpoint
      ORDER BY revenue_lost DESC
      LIMIT 20
    `, [customer.id])

    const summary   = summaryResult.rows[0]
    const endpoints = endpointResult.rows
    const topEndpoint = endpoints[0] || null

    // Build the core output
    const revenueLost = parseFloat(summary.revenue_lost) || 0

    const report = {
      customer: {
        company: customer.company,
        email:   customer.email,
      },
      period,
      generated_at: new Date().toISOString(),

      // THE NUMBER — this is what they pay for
      revenue_lost: revenueLost,
      revenue_lost_formatted: formatDollar(revenueLost),

      summary: {
        total_requests:  parseInt(summary.total_requests)  || 0,
        failed_requests: parseInt(summary.failed_requests) || 0,
        failure_rate:    parseFloat(summary.failure_rate)  || 0,
        avg_latency_ms:  parseInt(summary.avg_latency_ms)  || 0,
      },

      // PRIMARY CAUSE — where most of the loss is coming from
      primary_cause: topEndpoint ? {
        endpoint:       topEndpoint.endpoint,
        revenue_lost:   parseFloat(topEndpoint.revenue_lost),
        failure_rate:   parseFloat(topEndpoint.failure_rate),
        failed_count:   parseInt(topEndpoint.failed),
        common_error:   topEndpoint.common_error,
        pct_of_total:   revenueLost > 0
          ? Math.round((parseFloat(topEndpoint.revenue_lost) / revenueLost) * 100)
          : 0,
      } : null,

      // THE FIX — estimated recovery if endpoint is fixed
      estimated_recovery: topEndpoint ? {
        endpoint:    topEndpoint.endpoint,
        recoverable: Math.round(parseFloat(topEndpoint.revenue_lost) * 0.65 * 100) / 100,
        method:      suggestFix(topEndpoint.common_error),
      } : null,

      // TRANSPARENCY — show the math so they trust the number
      calculation: {
        formula:          'failed_requests × avg_price_per_request',
        failed_requests:  parseInt(summary.failed_requests) || 0,
        avg_price:        revenueLost > 0 && parseInt(summary.failed_requests) > 0
          ? Math.round((revenueLost / parseInt(summary.failed_requests)) * 10000) / 10000
          : 0,
        result:           revenueLost,
      },

      // FULL BREAKDOWN by endpoint
      endpoints: endpoints.map(ep => ({
        endpoint:        ep.endpoint,
        total:           parseInt(ep.total),
        failed:          parseInt(ep.failed),
        failure_rate:    parseFloat(ep.failure_rate),
        revenue_lost:    parseFloat(ep.revenue_lost),
        avg_fail_latency: parseInt(ep.avg_fail_latency_ms) || null,
        common_error:    ep.common_error,
      }))
    }

    return res.status(200).json(report)
  } catch (err) {
    console.error('[report] Error:', err.message)
    return res.status(500).json({ error: 'Failed to generate report' })
  }
})

function formatDollar(n) {
  return '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function suggestFix(errorType) {
  const fixes = {
    timeout:          'Add retry logic with exponential backoff (3 attempts, 1s/2s/4s delays)',
    rate_limit:       'Implement request queuing with concurrency limits',
    server_error:     'Add circuit breaker pattern + fallback response',
    context_length:   'Validate and truncate request payloads before sending',
    invalid_request:  'Add input validation before calling the endpoint',
    auth_error:       'Check API key rotation and token refresh logic',
  }
  return fixes[errorType] || 'Investigate error patterns in your server logs'
}

module.exports = router
