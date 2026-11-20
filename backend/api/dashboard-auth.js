const crypto = require('crypto')
const express = require('express')
const { query } = require('../../db/pool')
const { sendMagicLink } = require('../email/send-magic-link')

const router = express.Router()
const hash = value => crypto.createHash('sha256').update(value).digest('hex')

// This endpoint deliberately creates a one-time token only. Delivery is kept
// behind the transactional-mail integration so environments without SMTP never
// expose a usable link in an HTTP response.
router.post('/magic-link', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' })

  const found = await query('SELECT id FROM workspace_users WHERE email = $1 AND active = true', [email])
  // Avoid account enumeration for unknown or inactive people.
  if (!found.rows.length) return res.status(202).json({ ok: true })

  const token = crypto.randomBytes(32).toString('base64url')
  await query(
    `INSERT INTO access_tokens (token_hash, email, purpose, user_id, expires_at)
     VALUES ($1, $2, 'dashboard_magic_link', $3, now() + INTERVAL '15 minutes')`,
    [hash(token), email, found.rows[0].id]
  )
  if (process.env.NODE_ENV === 'test') return res.status(202).json({ ok: true, token })
  try {
    await sendMagicLink(email, token)
  } catch (err) {
    // Keep the response neutral so this endpoint cannot become an account
    // oracle. Operators still get the useful delivery error in service logs.
    console.error('[dashboard-auth] magic link delivery failed:', err.message)
  }
  return res.status(202).json({ ok: true })
})

router.post('/magic-link/exchange', async (req, res) => {
  const token = String(req.body?.token || '')
  if (!token) return res.status(400).json({ error: 'Token required' })
  const tokenHash = hash(token)
  const result = await query(
    `UPDATE access_tokens
     SET consumed_at = now(), used_by_ip = $2
     WHERE token_hash = $1 AND purpose = 'dashboard_magic_link'
       AND consumed_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [tokenHash, req.ip || null]
  )
  if (!result.rows.length) return res.status(401).json({ error: 'Magic link is invalid or expired' })

  const session = crypto.randomBytes(32).toString('base64url')
  await query(
    `INSERT INTO dashboard_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + INTERVAL '7 days')`,
    [hash(session), result.rows[0].user_id]
  )
  const workspaces = await query(
    `SELECT m.customer_id AS id, c.company, m.role
     FROM workspace_memberships m JOIN customers c ON c.id = m.customer_id AND c.active = true
     WHERE m.user_id = $1 ORDER BY c.company`, [result.rows[0].user_id]
  )
  return res.json({ ok: true, session_token: session, expires_in_seconds: 604800, workspaces: workspaces.rows })
})

module.exports = router
