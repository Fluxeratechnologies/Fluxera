# Fluxera V1 — Deployment Guide
# From zero to live in ~2 hours

## WHAT YOU'RE DEPLOYING

```
fluxera/
├── backend/
│   ├── server.js          ← Main Express server + cron jobs
│   ├── api/
│   │   ├── ingest.js      ← POST /api/ingest (SDK hits this)
│   │   ├── report.js      ← GET  /api/report (customer dashboard)
│   │   ├── customers.js   ← POST /api/customers (create accounts)
│   │   ├── waitlist.js    ← POST /api/waitlist
│   │   └── auth.js        ← API key validation middleware
│   ├── processor/
│   │   └── run.js         ← Hourly: failed × price = loss
│   └── email/
│       ├── send-report.js ← Daily: sends revenue loss emails
│       └── templates.js   ← HTML + text email templates
├── db/
│   ├── schema.sql         ← Full PostgreSQL schema
│   ├── migrate.js         ← Run once to set up DB
│   └── pool.js            ← Shared connection pool
├── sdk/
│   ├── node/index.js      ← @fluxera/sdk (Node.js)
│   └── python/fluxera.py  ← fluxera-sdk (Python)
└── package.json
```

---

## STEP 1 — Set up PostgreSQL (15 min)

### Option A: Supabase (easiest, free tier)
1. Go to supabase.com → New project
2. Copy your connection string (Settings → Database → Connection string → URI)
3. It looks like: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

### Option B: AWS RDS
1. RDS console → Create database → PostgreSQL
2. Instance: db.t3.micro (free tier)
3. Copy endpoint, port, username, password

---

## STEP 2 — Set up Email (10 min)

### Use Resend (recommended — generous free tier)
1. resend.com → Create account
2. Add your domain (fluxeratechnologies.ai)
3. Get your API key
4. SMTP settings:
   - Host: smtp.resend.com
   - Port: 587
   - User: resend
   - Pass: re_your_api_key

---

## STEP 3 — Deploy Backend to AWS (30 min)

### Option A: AWS EC2 (cheapest, ~$5/month)

```bash
# Launch EC2 instance (Ubuntu 22.04 LTS, t3.micro)
# SSH into it, then:

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone your repo
git clone https://github.com/yourorg/fluxera
cd fluxera
npm install

# Set up environment
cp .env.example .env
nano .env  # fill in DATABASE_URL, SMTP_*, etc.

# Run database migrations
node db/migrate.js

# Install PM2 for process management
sudo npm install -g pm2

# Start the server
pm2 start backend/server.js --name fluxera
pm2 startup  # auto-restart on reboot
pm2 save
```

### Option B: Railway (easiest, ~$5/month)
1. railway.app → New project → Deploy from GitHub
2. Add environment variables in Railway dashboard
3. Done — Railway handles deployment automatically

### Option C: Render.com (free tier available)
1. render.com → New Web Service → Connect GitHub
2. Build command: `npm install`
3. Start command: `node backend/server.js`
4. Add environment variables

---

## STEP 4 — Run Migrations

```bash
# From your server or locally (with DATABASE_URL set):
node db/migrate.js

# Verify tables created:
psql $DATABASE_URL -c "\dt"
# Should show: customers, request_logs, revenue_reports, alerts_sent, waitlist
```

---

## STEP 5 — Create Your First Customer

```bash
# POST to your API to create a customer account
curl -X POST https://your-domain.com/api/customers \
  -H "Content-Type: application/json" \
  -H "x-api-secret: YOUR_API_SECRET_FROM_ENV" \
  -d '{
    "email": "customer@theircompany.com",
    "company": "Their Company Inc",
    "price_default": 0.04,
    "plan": "free"
  }'

# Response includes their API key:
# { "ok": true, "customer": { "api_key": "fx_abc123..." } }
```

---

## STEP 6 — Customer Installs SDK

### Node.js (send to customer)
```bash
npm install @fluxera/sdk
```

```javascript
const fluxera = require('@fluxera/sdk')('fx_their_api_key')

// Before: untracked
const result = await openai.chat.completions.create({ ... })

// After: tracked
const result = await fluxera.track(
  () => openai.chat.completions.create({ ... }),
  { endpoint: '/v1/chat/completions', price: 0.04 }
)
```

### Python (send to customer)
```bash
pip install fluxera-sdk
```

```python
import fluxera
fluxera.init('fx_their_api_key')

@fluxera.track(endpoint='/v1/generate', price=0.04)
def call_api():
    return openai.completions.create(...)
```

---

## STEP 7 — Verify It's Working

```bash
# Check health endpoint
curl https://your-domain.com/health
# → { "ok": true, "db": "connected" }

# Customer can check their report
curl https://your-domain.com/api/report \
  -H "Authorization: Bearer fx_their_api_key"
# → { "revenue_lost": 234.50, "failed_requests": 1250, ... }
```

---

## STEP 8 — Set Up Domain + SSL

```bash
# On EC2 with nginx:
sudo apt install nginx certbot python3-certbot-nginx

# Configure nginx reverse proxy
sudo nano /etc/nginx/sites-available/fluxera
# (paste config below)

sudo certbot --nginx -d api.fluxeratechnologies.ai
```

### Nginx config
```nginx
server {
    server_name api.fluxeratechnologies.ai;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## CRON JOBS (built into server.js)

The server runs two cron jobs automatically:

| Job        | Schedule      | What it does                              |
|------------|---------------|-------------------------------------------|
| Processor  | Every hour    | Aggregates logs, computes revenue loss    |
| Report     | 8am UTC daily | Sends revenue loss email to each customer |

To run manually:
```bash
node backend/processor/run.js   # run processor now
node backend/email/send-report.js  # send reports now
```

---

## PRICING (V1)

Charge customers $500/month.
That's your hook:
> "We'll show you how much money your API failures cost you.
>  Most customers find we save them 10x our fee."

Sales flow:
1. Customer joins waitlist
2. You create their account (POST /api/customers)
3. They install the SDK (10 min)
4. They receive first report within 24 hours
5. Report shows the dollar number → they pay

---

## TROUBLESHOOTING

```bash
# Check logs
pm2 logs fluxera

# Check DB connection
node -e "require('./db/pool').query('SELECT 1').then(() => console.log('DB OK')).catch(console.error)"

# Test ingest manually
curl -X POST https://your-domain.com/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fx_customer_key" \
  -d '{"logs": [{"endpoint":"/test","status":"fail","latency_ms":1200,"price":0.04}]}'
```

---

## V1 DONE — DON'T ADD MORE

V1 ships with exactly:
- ✅ SDK (Node + Python)
- ✅ Ingest API
- ✅ PostgreSQL storage
- ✅ Hourly processor
- ✅ Daily email report
- ✅ Revenue loss calculation

V1 does NOT have:
- ❌ Dashboard (not needed)
- ❌ AI analysis (not needed)
- ❌ Real-time streaming (not needed)
- ❌ Self-serve signup (not yet)

Ship V1. Get 5 paying customers. Then build V2.
