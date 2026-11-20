const crypto = require('crypto')

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const TRACKED_EVENTS = [
  'page_view',
  'try_opened',
  'tutorial_begin',
  'tutorial_complete',
  'playground_scenario_started',
  'playground_evidence_viewed',
  'playground_decision_made',
  'playground_outcome_viewed',
  'playground_reset',
  'playground_access_clicked',
  'generate_lead',
  'trial_activated',
  'first_live_event',
  'first_approval_decision',
  'first_verified_recovery',
]

let tokenCache = null
const reportCache = new Map()

function base64url(value) {
  return Buffer.from(value).toString('base64url')
}

function credentialsFromEnv(env = process.env) {
  if (env.GA4_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(env.GA4_SERVICE_ACCOUNT_JSON)
      return { clientEmail: parsed.client_email, privateKey: parsed.private_key }
    } catch {
      throw new Error('GA4_SERVICE_ACCOUNT_JSON is not valid JSON')
    }
  }
  return {
    clientEmail: env.GA4_CLIENT_EMAIL,
    privateKey: env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }
}

function configuration(env = process.env) {
  const credentials = credentialsFromEnv(env)
  const propertyId = String(env.GA4_PROPERTY_ID || '').replace(/^properties\//, '')
  const configured = Boolean(propertyId && credentials.clientEmail && credentials.privateKey)
  return { ...credentials, propertyId, configured }
}

function createAssertion({ clientEmail, privateKey }, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }))
  const unsigned = `${header}.${payload}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')
  return `${unsigned}.${signature}`
}

async function accessToken(config, fetchImpl = fetch) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createAssertion(config),
    }),
  })
  if (!response.ok) throw new Error(`GA4 authentication failed (${response.status})`)
  const payload = await response.json()
  tokenCache = { value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 }
  return tokenCache.value
}

async function runReport(config, body, fetchImpl = fetch) {
  const token = await accessToken(config, fetchImpl)
  const response = await fetchImpl(`${DATA_API}/properties/${config.propertyId}:runReport`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`GA4 report failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`)
  }
  return response.json()
}

function rows(report, dimensions, metrics) {
  return (report.rows || []).map((row) => ({
    ...Object.fromEntries(dimensions.map((name, index) => [name, row.dimensionValues?.[index]?.value || '(not set)'])),
    ...Object.fromEntries(metrics.map((name, index) => [name, Number(row.metricValues?.[index]?.value || 0)])),
  }))
}

async function growthReport(days = 30, options = {}) {
  const config = configuration(options.env)
  if (!config.configured) return { configured: false, events: [], sources: [], updated_at: null }
  const cacheKey = `${config.propertyId}:${days}`
  const cached = reportCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }]
  const eventFilter = { filter: { fieldName: 'eventName', inListFilter: { values: TRACKED_EVENTS } } }
  const [eventReport, sourceReport] = await Promise.all([
    runReport(config, {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: eventFilter,
      limit: 50,
    }, options.fetch),
    runReport(config, {
      dateRanges,
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'generate_lead' } } },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 12,
    }, options.fetch),
  ])
  const value = {
    configured: true,
    events: rows(eventReport, ['event_name'], ['event_count', 'users']),
    sources: rows(sourceReport, ['source', 'medium'], ['users', 'lead_events']),
    updated_at: new Date().toISOString(),
  }
  reportCache.set(cacheKey, { value, expiresAt: Date.now() + 5 * 60_000 })
  return value
}

module.exports = { TRACKED_EVENTS, configuration, createAssertion, growthReport, rows }
