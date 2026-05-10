// db/pool.js
// Single shared PostgreSQL connection pool
// Import this everywhere instead of creating new pools

require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message)
})

// Convenience wrapper — always releases client
async function query(sql, params = []) {
  const client = await pool.connect()
  try {
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}

module.exports = { pool, query }
