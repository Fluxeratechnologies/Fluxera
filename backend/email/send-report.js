// backend/email/send-report.js
// Sends the daily revenue loss report to every active customer
// Called by cron at 8am UTC daily
//
// The email IS the product. Make it good.
// One number. One cause. One fix.

require('dotenv').config()
const nodemailer = require('nodemailer')
const { query }  = require('../../db/pool')
const { buildEmailHTML, buildEmailText } = require('./templates')

// Configure SMTP transport
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

async function sendDailyReports() {
  // Get all customers who have logs in the last 24h
  const customersResult = await query(`
    SELECT DISTINCT c.id, c.email, c.company
    FROM customers c
    JOIN request_logs r ON r.customer_id = c.id
    WHERE c.active = true
      AND r.logged_at > now() - INTERVAL '24 hours'
  `)

  const customers = customersResult.rows
  console.log(`[email] Sending to ${customers.length} customers`)

  let sent = 0, failed = 0

  for (const customer of customers) {
    // Skip if already sent today
    const alreadySent = await query(`
      SELECT id FROM alerts_sent
      WHERE customer_id = $1
        AND alert_type  = 'daily_report'
        AND sent_at     > now() - INTERVAL '20 hours'
    `, [customer.id])

    if (alreadySent.rows.length > 0) {
      console.log(`[email] Skipping ${customer.email} — already sent today`)
      continue
    }

    try {
      const report = await buildReport(customer.id)
      if (!report) continue

      await transporter.sendMail({
        from:    `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to:      customer.email,
        subject: `💸 You lost ${report.revenue_lost_formatted} in the last 24 hours — Fluxera`,
        html:    buildEmailHTML(report, customer),
        text:    buildEmailText(report, customer),
      })

      // Log that we sent it
      await query(`
        INSERT INTO alerts_sent (customer_id, alert_type)
        VALUES ($1, 'daily_report')
      `, [customer.id])

      console.log(`[email] Sent to ${customer.email}: ${report.revenue_lost_formatted} lost`)
      sent++
    } catch (err) {
      console.error(`[email] Failed for ${customer.email}:`, err.message)
      failed++
    }
  }

  return { sent, failed }
}

// Build the report data for one customer (last 24h)
async function buildReport(customerId) {
  const summaryResult = await query(`
    SELECT
      COUNT(*)                                                    AS total_requests,
      COUNT(*) FILTER (WHERE status = 'fail')                     AS failed_requests,
      ROUND(COUNT(*) FILTER (WHERE status = 'fail')::NUMERIC
        / NULLIF(COUNT(*), 0) * 100, 2)                          AS failure_rate,
      COALESCE(SUM(price) FILTER (WHERE status = 'fail'), 0)     AS revenue_lost
    FROM request_logs
    WHERE customer_id = $1
      AND logged_at   > now() - INTERVAL '24 hours'
  `, [customerId])

  const endpointResult = await query(`
    SELECT
      endpoint,
      COUNT(*) FILTER (WHERE status = 'fail')                    AS failed,
      COUNT(*)                                                    AS total,
      COALESCE(SUM(price) FILTER (WHERE status = 'fail'), 0)     AS revenue_lost,
      ROUND(COUNT(*) FILTER (WHERE status = 'fail')::NUMERIC
        / COUNT(*) * 100, 2)                                     AS failure_rate,
      MODE() WITHIN GROUP (ORDER BY error_type)                   AS top_error
    FROM request_logs
    WHERE customer_id = $1
      AND logged_at   > now() - INTERVAL '24 hours'
    GROUP BY endpoint
    ORDER BY revenue_lost DESC
    LIMIT 5
  `, [customerId])

  const summary   = summaryResult.rows[0]
  const endpoints = endpointResult.rows
  const top       = endpoints[0]

  const revenueLost = parseFloat(summary.revenue_lost) || 0
  if (revenueLost === 0) return null // Nothing to report

  const failedRequests = parseInt(summary.failed_requests) || 0
  const avgPrice       = failedRequests > 0 ? revenueLost / failedRequests : 0

  return {
    period:                  '24 hours',
    revenue_lost:            revenueLost,
    revenue_lost_formatted:  formatDollar(revenueLost),
    monthly_projection:      formatDollar(revenueLost * 30),
    total_requests:          parseInt(summary.total_requests) || 0,
    failed_requests:         failedRequests,
    failure_rate:            parseFloat(summary.failure_rate) || 0,

    primary_cause: top ? {
      endpoint:      top.endpoint,
      failed:        parseInt(top.failed),
      revenue_lost:  parseFloat(top.revenue_lost),
      failure_rate:  parseFloat(top.failure_rate),
      pct_of_total:  revenueLost > 0
        ? Math.round((parseFloat(top.revenue_lost) / revenueLost) * 100)
        : 0,
      top_error:     top.top_error,
    } : null,

    fix: top ? {
      endpoint:    top.endpoint,
      action:      getFix(top.top_error),
      recoverable: formatDollar(parseFloat(top.revenue_lost) * 0.65),
    } : null,

    transparency: {
      formula:          'failed_requests × avg_price',
      failed_requests:  failedRequests,
      avg_price:        formatDollar(avgPrice),
      result:           formatDollar(revenueLost),
    },

    endpoints: endpoints.map(ep => ({
      name:         ep.endpoint,
      failed:       parseInt(ep.failed),
      total:        parseInt(ep.total),
      failure_rate: parseFloat(ep.failure_rate),
      lost:         formatDollar(parseFloat(ep.revenue_lost)),
    }))
  }
}

function formatDollar(n) {
  return '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getFix(errorType) {
  const fixes = {
    timeout:        'Add retry logic with exponential backoff (3 attempts, 1s/2s/4s)',
    rate_limit:     'Implement request queuing with concurrency limits',
    server_error:   'Add circuit breaker pattern + fallback response',
    context_length: 'Validate and truncate request payloads before sending',
    auth_error:     'Check API key rotation and token refresh logic',
  }
  return fixes[errorType] || 'Review error logs and add retry logic'
}

module.exports = { sendDailyReports, buildReport }
