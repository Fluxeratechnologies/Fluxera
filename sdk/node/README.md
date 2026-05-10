# @fluxera/sdk

**Fluxera Technologies** — Track exactly how much money your API failures cost you.

## Install

```bash
npm install @fluxera/sdk
```

## Usage

```javascript
const fluxera = require('@fluxera/sdk')('fx_your_api_key')

// Wrap your existing API calls. That's it.
const result = await fluxera.track(
  () => openai.chat.completions.create({ model: 'gpt-4', messages }),
  {
    endpoint: '/v1/chat/completions',
    price:    0.04   // cost of this call in USD
  }
)
```

On failure, you'll receive an email:

```
💸 You lost $2,340 in the last 24 hours

Primary cause: 78% of loss from /v1/chat/completions
Issue: timeout errors · Failed requests: 3,900

Fix: Add retry logic with exponential backoff
Potential recovery: $1,120/day

Based on: 3,900 failed requests × $0.04 avg price
```

## API

### `fluxera.track(fn, opts)`

Wraps any async function. Captures success/failure, latency, and price.

```javascript
const result = await fluxera.track(
  async () => await yourApiCall(),
  {
    endpoint:   '/v1/generate',   // required: your endpoint name
    price:      0.04,             // required: cost per call in USD
    request_id: 'req_abc123',     // optional: for deduplication
  }
)
```

Returns whatever your function returns. Re-throws errors — never swallows them.

### `fluxera.batch(logs)`

Send pre-collected logs directly.

```javascript
await fluxera.batch([
  { endpoint: '/v1/generate', status: 'fail', latency_ms: 920, price: 0.04, error_type: 'timeout' },
  { endpoint: '/v1/embed',    status: 'success', latency_ms: 120, price: 0.01 },
])
```

## Python

```python
import fluxera
fluxera.init('fx_your_api_key')

# Decorator
@fluxera.track(endpoint='/v1/generate', price=0.04)
def call_api(prompt):
    return openai.completions.create(prompt=prompt)

# Async decorator
@fluxera.async_track(endpoint='/v1/chat', price=0.06)
async def chat(messages):
    return await openai.chat.completions.create(messages=messages)

# Manual
result = fluxera.track_call(
  lambda: openai.completions.create(...),
  endpoint='/v1/generate',
  price=0.04
)
```

## SDK Events (what gets sent)

```json
{
  "request_id": "req_abc123",
  "endpoint":   "/v1/generate",
  "status":     "fail",
  "latency_ms": 4200,
  "price":      0.04,
  "error_type": "timeout",
  "timestamp":  "2026-05-01T14:23:11Z"
}
```

Events are batched (max 50) and sent every 30 seconds or when the batch fills.
They never block your main thread.

---

fluxeratechnologies.ai
