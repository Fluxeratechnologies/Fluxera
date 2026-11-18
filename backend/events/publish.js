const { query } = require('../../db/pool')

async function publishWorkspaceEvent(customerId, eventType, payload = {}) {
  const result = await query(
    `INSERT INTO workspace_events (customer_id, event_type, payload)
     VALUES ($1, $2, $3) RETURNING id, created_at`,
    [customerId, eventType, JSON.stringify(payload)]
  )
  return result.rows[0]
}

module.exports = { publishWorkspaceEvent }
