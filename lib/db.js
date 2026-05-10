// lib/db.js
// Shared PostgreSQL client for all Vercel serverless functions
// Uses connection pooling to avoid exhausting DB connections

import { Pool } from 'pg'

let pool

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }
  return pool
}

export async function query(sql, params = []) {
  const client = await getPool().connect()
  try {
    const result = await client.query(sql, params)
    return result
  } finally {
    client.release()
  }
}
