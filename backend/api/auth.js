// backend/api/auth.js
// Validates SDK API keys from Authorization header
// Usage: const customer = await requireAuth(req, res)

const crypto = require('crypto')
const { query } = require('../../db/pool')

async function requireAuth(req, res) {
  const header = req.headers['authorization'] || ''
  const apiKey = header.replace('Bearer ', '').trim()

  if (!apiKey || !apiKey.startsWith('fx_')) {
    res.status(401).json({
      error: 'Missing or invalid API key',
      hint:  'Pass your Fluxera API key as: Authorization: Bearer fx_...'
    })
    return null
  }

  try {
    const result = await query(
      'SELECT id, email, company, price_default, abandonment_rate, avg_order_value, webhook_url, interrupt_after_minutes FROM customers WHERE api_key = $1 AND active = true',
      [apiKey]
    )
    if (!result.rows.length) {
      res.status(401).json({ error: 'API key not found or account inactive' })
      return null
    }
    return result.rows[0]
  } catch (err) {
    console.error('[auth] DB error:', err.message)
    res.status(500).json({ error: 'Auth failed' })
    return null
  }
}

// For cron-triggered internal endpoints
function requireCronSecret(req, res) {
  const secret = req.headers['x-fluxera-secret'] || req.query.secret
  if (!secret || secret !== process.env.CRON_SECRET) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}

// Dashboard authentication is intentionally separate from SDK ingestion.
// A bearer `fx_` key is never accepted here, even if it belongs to the same
// workspace, so leaked ingestion credentials cannot approve external actions.
async function requireWorkspaceRole(req, res, allowedRoles = []) {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  const customerId = String(req.headers['x-fluxera-workspace'] || '').trim()
  if (!token || token.startsWith('fx_') || !customerId) {
    res.status(401).json({ error: 'Dashboard session and workspace are required' })
    return null
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  try {
    const result = await query(
      `SELECT u.id AS user_id, u.email, m.customer_id, m.role, c.company
       FROM dashboard_sessions s
       JOIN workspace_users u ON u.id = s.user_id AND u.active = true
       JOIN workspace_memberships m ON m.user_id = u.id
       JOIN customers c ON c.id = m.customer_id AND c.active = true
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
         AND m.customer_id = $2`,
      [tokenHash, customerId]
    )
    const actor = result.rows[0]
    if (!actor) {
      res.status(401).json({ error: 'Session is invalid, expired, or not a workspace member' })
      return null
    }
    if (allowedRoles.length && !allowedRoles.includes(actor.role)) {
      res.status(403).json({ error: 'Your workspace role cannot perform this action' })
      return null
    }
    query('UPDATE dashboard_sessions SET last_seen_at = now() WHERE token_hash = $1', [tokenHash]).catch(() => {})
    return actor
  } catch (err) {
    console.error('[dashboard-auth] DB error:', err.message)
    res.status(500).json({ error: 'Dashboard authentication failed' })
    return null
  }
}

async function requireStaff(req, res) {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token || token.startsWith('fx_')) {
    res.status(401).json({ error: 'Staff dashboard session is required' })
    return null
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  try {
    const result = await query(
      `SELECT u.id AS user_id, u.email
       FROM dashboard_sessions s JOIN workspace_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
         AND u.active = true AND u.is_staff = true`,
      [tokenHash]
    )
    const actor = result.rows[0]
    if (!actor) {
      res.status(403).json({ error: 'Staff access is required' })
      return null
    }
    return actor
  } catch (err) {
    console.error('[staff-auth] DB error:', err.message)
    res.status(500).json({ error: 'Staff authentication failed' })
    return null
  }
}

module.exports = { requireAuth, requireCronSecret, requireWorkspaceRole, requireStaff }
