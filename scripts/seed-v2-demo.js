// Creates one stable, local-only V2 ingestion fixture. Never run against production.
require('dotenv').config()
const { pool, query } = require('../db/pool')

const TEST_KEY = process.env.FLUXERA_TEST_API_KEY || 'fx_test_fluxera_local_9ed6e1b0'
const TEST_EMAIL = 'dev@fluxera.local'
const TEST_COMPANY = 'Fluxera Local Pilot'

async function seedDemo() {
  if (process.env.NODE_ENV === 'production' || process.env.FLUXERA_ALLOW_DEV_SEED !== 'true') throw new Error('Refusing to seed. Run only through npm run seed:dev against a local development database.')
  const customer = await query(`INSERT INTO customers (email, company, api_key, active) VALUES ($1, $2, $3, true) ON CONFLICT (email) DO UPDATE SET company = EXCLUDED.company, api_key = EXCLUDED.api_key, active = true RETURNING id`, [TEST_EMAIL, TEST_COMPANY, TEST_KEY])
  const user = await query(`INSERT INTO workspace_users (email, active) VALUES ($1, true) ON CONFLICT (email) DO UPDATE SET active = true RETURNING id`, [TEST_EMAIL])
  await query(`INSERT INTO workspace_memberships (customer_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT (customer_id, user_id) DO UPDATE SET role = 'owner'`, [customer.rows[0].id, user.rows[0].id])
  console.log(`Development workspace ready: ${TEST_COMPANY}`)
  console.log(`Development ingestion key: ${TEST_KEY}`)
  console.log(`Dashboard email: ${TEST_EMAIL} (request a magic link; fx_ keys cannot access the dashboard)`)
}

seedDemo().catch((err) => { console.error(`Seed failed: ${err.message}`); process.exitCode = 1 }).finally(() => pool.end())
