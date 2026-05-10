// api/analyze.js
// POST /api/analyze
// Secure proxy to Anthropic API — API key never exposed to browser
// Accepts raw log text → returns AI diagnosis JSON

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { logs, format, pricePerRequest, timeWindow } = req.body

  if (!logs || typeof logs !== 'string' || logs.trim().length === 0) {
    return res.status(400).json({ error: 'logs string required' })
  }

  // Rate limiting — basic (use Upstash Redis for production)
  // Each IP gets 10 free analyses per day
  // TODO: implement with Upstash rate limiter

  const prompt = `You are Fluxera, an expert API revenue leak analyzer built by Fluxera Technologies (fluxeratechnologies.ai).

Analyze these API logs and return a structured JSON diagnosis.

INPUT:
- Format: ${format || 'auto-detect'}
- Price per request: $${pricePerRequest || 0.04}
- Time window: ${timeWindow || '24 hours'}

RAW LOGS:
${logs.slice(0, 8000)}

Parse the logs, then respond ONLY with valid JSON (no markdown, no explanation):
{
  "total_requests": number,
  "failed_requests": number,
  "failure_rate": number,
  "revenue_lost": number,
  "projected_monthly_loss": number,
  "severity": "critical|high|medium|low",
  "headline": "One sharp sentence with the key finding and dollar amount",
  "insights": [
    { "type": "critical|warning|info|fix", "text": "Specific finding with exact numbers" },
    { "type": "critical|warning|info|fix", "text": "..." },
    { "type": "critical|warning|info|fix", "text": "..." },
    { "type": "fix", "text": "Specific actionable fix with estimated recovery amount" }
  ],
  "endpoints": [
    {
      "name": "/endpoint/path",
      "total": number,
      "failed": number,
      "failure_rate": number,
      "revenue_lost": number,
      "avg_latency_ms": number,
      "likely_cause": "timeout|rate_limit|server_error|auth_error|unknown"
    }
  ],
  "narrative": "3 paragraph technical analysis. Be ruthless with specifics. Name exact endpoints. Give exact numbers. Diagnose the likely root cause from error types and latency. Tell them what to fix first and why. Use **bold** for key numbers.",
  "quick_wins": [
    "Specific thing they can do in the next hour to stop bleeding",
    "Second quick win"
  ]
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[analyze] Anthropic error:', err)
      return res.status(502).json({ error: 'AI service unavailable' })
    }

    const data = await response.json()
    const text = data.content?.map(c => c.text || '').join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'AI returned malformed response', raw: text.slice(0, 500) })
    }

    return res.status(200).json(parsed)

  } catch (err) {
    console.error('[analyze] Error:', err.message)
    return res.status(500).json({ error: 'Analysis failed' })
  }
}
