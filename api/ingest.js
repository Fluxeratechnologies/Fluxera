// api/ingest.js
// POST /api/ingest
// Receives batched request logs from the @fluxera/sdk
// Validates API key → stores in PostgreSQL → returns ack

import { query } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'

export default async function handler(req, res) {
  // CORS — allow SDK calls from any origin
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth
  const customer = await requireAuth(req, res)
  if (!customer) return

  // Parse body
  const { logs } = req.body
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'logs array required' })
  }

  // Validate + sanitize each log
  const valid = logs.filter(log =>
    log.request_id &&
    log.endpoint &&
    ['success', 'fail'].includes(log.status)
  )

  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid log entries' })
  }

  // Batch insert — one query, not N queries
  const values = valid.map((log, i) => {
    const base = i * 7
    return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6}, $${base+7})`
  }).join(', ')

  const params = valid.flatMap(log => [
    customer.id,
    log.request_id,
    log.endpoint,
    log.status,
    log.latency || null,
    log.price_per_request || customer.price_per_request,
    log.error_type || null
  ])

  try {
    await query(
      `INSERT INTO request_logs
        (customer_id, request_id, endpoint, status, latency, price_per_request, error_type)
       VALUES ${values}
       ON CONFLICT DO NOTHING`,
      params
    )

    return res.status(200).json({
      accepted: valid.length,
      rejected: logs.length - valid.length
    })
  } catch (err) {
    console.error('[ingest] DB error:', err.message)
    return res.status(500).json({ error: 'Failed to store logs' })
  }
}
