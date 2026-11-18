# Fluxera — The Reliability & Recovery Engine

<p align="center">
  <img src="frontend/public/favicon.svg" width="72" height="72" alt="Fluxera Logo" />
</p>

<p align="center">
  <strong>Approval-gated continuity intelligence for modern SaaS and AI systems.</strong>
</p>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#sdk-integration">SDK Integration</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## 🎯 What is Fluxera?

Modern software architectures depend on a brittle web of third-party APIs, AI models, vector stores, and microservices. When upstream dependencies degrade, timeout, or rate-limit:
- **Traditional APMs** flood operators with millions of noisy, un-actionable log lines.
- **Fluxera** records metadata-only execution telemetry, identifies continuity risks, and routes every external recovery through a human approval gate.

> V2 is a best-effort pilot on free-tier infrastructure. It does not provide a
> 24/7 uptime guarantee or SLA. A successful webhook delivery is not considered
> recovery success; the linked execution must later verify it.

---

## ✨ Key Features

- ⚡ **Approval-Gated Recovery**: Recovery requests are created for failures or stalls, then dispatched only after an authorized human approves them.
- 💰 **Financial Leakage Attribution**: Directly computes failed API execution cost and estimated customer revenue at risk ($/min) in real time.
- 🔌 **Node Telemetry SDK**: Canonical agent, API, workflow, tool, and memory events with lineage, attempts, checkpoints, latency, and direct cost. Authenticated HTTP ingestion is available for other runtimes; Python is not feature-complete in V2.
- 📊 **Real-time Telemetry Dashboard**: Live transaction feed, endpoint leakage breakdowns, and execution trace inspection.
- 🛡️ **Self-Healing Safeguards**: Circuit breaking, jittered exponential backoff, and blast-radius isolation.
- 📧 **Automated Intelligence Reports**: Daily automated digest emails summarizing reliability metrics, recovered revenue, and recurring degradation patterns.

---

## 🏗️ Architecture

```
                                  ┌────────────────────────┐
                                  │   Upstream Services    │
                                  │ (OpenAI, Claude, AWS)  │
                                  └───────────▲────────────┘
                                              │
    ┌─────────────────────────┐               │ Fallback & Recovery
    │ Customer Application    ├───────────────┤
    │ (Node.js / Python App)  │               │
    └───────────┬─────────────┘               │
                │ Wrapped by SDK              │
                ▼                             │
    ┌─────────────────────────┐               │
    │  Fluxera Ingest Engine  │───────────────┘
    │   (POST /api/ingest)    │
    └───────────┬─────────────┘
                │ Async Event Stream
                ▼
    ┌─────────────────────────┐      ┌─────────────────────────┐
    │   PostgreSQL Database   │◄────►│  Intelligence Processor │
    │  (Telemetry & Traces)   │      │ (Leak Detection & Cron) │
    └───────────┬─────────────┘      └────────────┬────────────┘
                │                                 │
                ▼                                 ▼
    ┌─────────────────────────┐      ┌─────────────────────────┐
    │   Frontend Dashboard    │      │  Email Alert Dispatcher │
    │ (React / Standalone UI) │      │  (Daily Revenue Digest) │
    └─────────────────────────┘      └─────────────────────────┘
```

---

## 🚀 Quickstart

### 1. Prerequisites
- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14 (or Supabase / Neon / RDS instance)

### 2. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/fluxera-technologies/fluxera.git
cd fluxera

# Install root & backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

Key variables:
```ini
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/fluxera
FLUXERA_SECRET_KEY=fx_master_secret_key
EMAIL_HOST=smtp.resend.com
EMAIL_USER=resend
EMAIL_PASS=re_your_api_key
```

### 4. Database Setup & Seed
```bash
# Run database schema migrations
npm run migrate

# Seed demo customer accounts & initial telemetry data
npm run seed
npm run seed:intel
```

### 5. Launch the Application
```bash
# Terminal 1: Run Backend API & Ingestion Server
npm run dev

# Terminal 2: Run Frontend UI
cd frontend && npm run dev
```

Visit the application:
- **Interactive Web App**: [http://localhost:5173/](http://localhost:5173/)
- **Backend Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 📦 SDK Integration

### Node.js Integration
```bash
npm install @fluxera/sdk
```

```javascript
const fluxera = require('@fluxera/sdk')({
  apiKey: process.env.FLUXERA_API_KEY, // e.g. "fx_live_..."
  fallbackProvider: 'anthropic'
});

// Wrap critical upstream API calls with automated tracking & healing
const response = await fluxera.track(
  () => openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Process order payload' }]
  }),
  {
    endpoint: '/v1/chat/completions',
    workflow: 'checkout_orchestrator',
    pricePerCall: 0.04
  }
);
```

### Python Integration
```bash
pip install fluxera-sdk
```

```python
import fluxera

fluxera.init(api_key="fx_live_your_key")

@fluxera.track(endpoint="/v1/chat/completions", workflow="rag_synthesizer", price=0.04)
def generate_summary(prompt: str):
    return openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
```

---

## 📡 API Reference

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health check | None |
| `POST` | `/api/ingest` | Ingest metadata-only execution events | `Authorization: Bearer fx_…` |
| `POST` | `/api/dashboard-auth/magic-link` | Request a single-use human sign-in link | None |
| `POST` | `/api/dashboard-auth/magic-link/exchange` | Exchange link token for dashboard session | None |
| `GET` | `/api/recovery-requests` | List approval-gated recovery requests | Dashboard session + workspace |
| `POST` | `/api/recovery-requests/:id/approve` | Approve and durably enqueue a recovery dispatch | Approver, admin, or owner |
| `POST` | `/api/recovery-requests/:id/reject` | Reject a recovery request | Approver, admin, or owner |
| `POST` | `/api/integrations` | Create a disabled HMAC webhook integration; secret returned once | Owner or admin |
| `GET` | `/api/analysis/:customerId` | Financial leak calculations & metrics | `x-api-key` |
| `GET` | `/api/workflows` | List registered workflows & heal rates | `x-api-key` |
| `GET` | `/api/tools/status` | Real-time dependency health statuses | `x-api-key` |
| `GET` | `/api/executions` | Execution audit log with trace data | `x-api-key` |

---

## 🧪 Testing

```bash
# Run unit & integration test suites
npm test
```

## V2 worker

Run the worker separately from the API (for example, as the dedicated Render
worker service):

```bash
npm run worker
```

The worker safely leases PostgreSQL jobs, sends `Idempotency-Key`,
`X-Fluxera-Timestamp`, and `X-Fluxera-Signature` headers, and waits for a
linked SDK execution before marking a recovery as verified. An integration must
be HTTPS, explicitly idempotency-capable, and manually activated before any
dispatch can occur.

---

## 🚀 Deployment

For production deployment instructions on Vercel, Railway, Render, or AWS, refer to the [DEPLOY.md](DEPLOY.md) guide.

---

## 📄 License

Proprietary © 2026 Fluxera Inc. All Rights Reserved.
