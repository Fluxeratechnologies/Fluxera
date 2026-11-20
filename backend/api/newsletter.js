const express = require('express')
const { query } = require('../../db/pool')
const { requireStaff } = require('./auth')

const router = express.Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254)
  const consent = req.body?.consent === true
  const consentVersion = String(req.body?.consent_version || '').trim().slice(0, 40)
  const source = String(req.body?.source || 'public_site').trim().slice(0, 80)
  if (!EMAIL_PATTERN.test(email) || !consent || !consentVersion) {
    return res.status(400).json({ error: 'A valid email and explicit consent are required' })
  }
  try {
    await query(
      `INSERT INTO newsletter_subscribers (email, status, consent_at, consent_version, source)
       VALUES ($1, 'subscribed', now(), $2, $3)
       ON CONFLICT (email) DO UPDATE SET status = 'subscribed', consent_at = now(),
         consent_version = EXCLUDED.consent_version, source = EXCLUDED.source, updated_at = now()`,
      [email, consentVersion, source]
    )
    return res.status(202).json({ ok: true })
  } catch (err) {
    console.error('[newsletter/subscribe]', err.message)
    return res.status(500).json({ error: 'Could not save subscription' })
  }
})

router.get('/', async (req, res) => {
  const staff = await requireStaff(req, res)
  if (!staff) return
  const result = await query(
    `SELECT id, email, status, consent_at, consent_version, source, created_at, updated_at
     FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 500`
  )
  return res.json({ subscribers: result.rows })
})

module.exports = router
