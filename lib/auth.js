// lib/auth.js
// Validates customer API keys sent in Authorization header
// Usage: const customer = await requireAuth(req, res)

import { query } from './db.js'

export async function requireAuth(req, res) {
  const auth = req.headers['authorization'] || ''
  const apiKey = auth.replace('Bearer ', '').trim()

  if (!apiKey || !apiKey.startsWith('fx_')) {
    res.status(401).json({ error: 'Missing or invalid API key' })
    return null
  }

  try {
    const result = await query(
      'SELECT * FROM customers WHERE api_key = $1',
      [apiKey]
    )
    if (!result.rows.length) {
      res.status(401).json({ error: 'API key not found' })
      return null
    }
    return result.rows[0]
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' })
    return null
  }
}

// For internal cron jobs — validates shared secret
export function requireCronSecret(req, res) {
  const secret = req.headers['x-fluxera-secret'] || req.query.secret
  if (secret !== process.env.FLUXERA_SECRET) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}
