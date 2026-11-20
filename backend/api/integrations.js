const crypto = require('crypto')
const express = require('express')
const { query } = require('../../db/pool')
const { requireWorkspaceRole } = require('./auth')

const router = express.Router()

router.get('/', async (req, res) => {
  const actor = await requireWorkspaceRole(req, res, ['owner', 'admin', 'approver', 'operator', 'viewer'])
  if (!actor) return
  const result = await query(
    `SELECT id, name, webhook_url, supports_idempotency_key, active, created_at, updated_at
     FROM workspace_integrations WHERE customer_id = $1 ORDER BY name`, [actor.customer_id]
  )
  return res.json({ integrations: result.rows })
})

router.post('/', async (req, res) => {
  const actor = await requireWorkspaceRole(req, res, ['owner', 'admin'])
  if (!actor) return
  const name = String(req.body?.name || '').trim().slice(0, 255)
  const webhookUrl = String(req.body?.webhook_url || '').trim()
  const supportsIdempotency = req.body?.supports_idempotency_key === true
  if (!name || !/^https:\/\//i.test(webhookUrl)) {
    return res.status(400).json({ error: 'A name and HTTPS webhook_url are required' })
  }
  if (!supportsIdempotency) {
    return res.status(400).json({ error: 'Recovery integrations must declare Idempotency-Key support' })
  }
  // The secret is displayed only in this creation response. Store it in the
  // customer receiver before enabling the integration; it cannot be retrieved.
  const signingSecret = crypto.randomBytes(32).toString('base64url')
  try {
    const result = await query(
      `INSERT INTO workspace_integrations
        (customer_id, name, webhook_url, signing_secret, supports_idempotency_key, active)
       VALUES ($1, $2, $3, $4, true, false)
       RETURNING id, name, webhook_url, supports_idempotency_key, active, created_at`,
      [actor.customer_id, name, webhookUrl, signingSecret]
    )
    return res.status(201).json({ integration: result.rows[0], signing_secret: signingSecret })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An integration with that name already exists' })
    console.error('[integrations/create]', err.message)
    return res.status(500).json({ error: 'Failed to create integration' })
  }
})

router.patch('/:id', async (req, res) => {
  const actor = await requireWorkspaceRole(req, res, ['owner', 'admin'])
  if (!actor) return
  const active = req.body?.active
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active must be a boolean' })
  const result = await query(
    `UPDATE workspace_integrations SET active = $3, updated_at = now()
     WHERE id = $1 AND customer_id = $2 AND supports_idempotency_key = true
     RETURNING id, name, webhook_url, supports_idempotency_key, active, updated_at`,
    [req.params.id, actor.customer_id, active]
  )
  if (!result.rows.length) return res.status(404).json({ error: 'Eligible integration not found' })
  return res.json({ integration: result.rows[0] })
})

module.exports = router
