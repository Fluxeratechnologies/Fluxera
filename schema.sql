-- ============================================================
-- FLUXERA TECHNOLOGIES — Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  company TEXT,
  api_key TEXT UNIQUE NOT NULL DEFAULT 'fx_' || gen_random_uuid()::text,
  plan TEXT DEFAULT 'free',           -- free | starter | pro
  price_per_request NUMERIC DEFAULT 0.04,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API REQUEST LOGS
CREATE TABLE request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  request_id TEXT,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'fail')),
  latency INTEGER,                    -- ms
  price_per_request NUMERIC,
  error_type TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast processor queries
CREATE INDEX idx_logs_customer_time ON request_logs(customer_id, timestamp DESC);
CREATE INDEX idx_logs_status ON request_logs(status);
CREATE INDEX idx_logs_endpoint ON request_logs(endpoint);

-- HOURLY REVENUE REPORTS (pre-computed by processor)
CREATE TABLE revenue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  failure_rate NUMERIC DEFAULT 0,
  revenue_lost NUMERIC DEFAULT 0,
  top_endpoint TEXT,
  report_json JSONB,                  -- full breakdown stored as JSON
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reports_customer ON revenue_reports(customer_id, period_start DESC);

-- ALERTS LOG
CREATE TABLE alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  report_id UUID REFERENCES revenue_reports(id),
  alert_type TEXT DEFAULT 'daily_summary',
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- WAITLIST
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  company TEXT,
  signed_up_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Current 24h loss per customer
CREATE VIEW current_daily_loss AS
SELECT
  c.id,
  c.email,
  c.company,
  COUNT(*) FILTER (WHERE r.status = 'fail') AS failed_requests,
  COUNT(*) AS total_requests,
  ROUND(COUNT(*) FILTER (WHERE r.status = 'fail')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS failure_rate,
  ROUND(SUM(CASE WHEN r.status = 'fail' THEN r.price_per_request ELSE 0 END), 4) AS revenue_lost_24h
FROM customers c
LEFT JOIN request_logs r
  ON r.customer_id = c.id
  AND r.timestamp > now() - INTERVAL '24 hours'
GROUP BY c.id, c.email, c.company;

-- Top leaking endpoints (last 24h, all customers)
CREATE VIEW top_leaking_endpoints AS
SELECT
  endpoint,
  COUNT(*) FILTER (WHERE status = 'fail') AS failures,
  COUNT(*) AS total,
  ROUND(COUNT(*) FILTER (WHERE status = 'fail')::NUMERIC / COUNT(*) * 100, 2) AS failure_rate,
  ROUND(SUM(CASE WHEN status = 'fail' THEN price_per_request ELSE 0 END), 4) AS total_lost
FROM request_logs
WHERE timestamp > now() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY total_lost DESC;
