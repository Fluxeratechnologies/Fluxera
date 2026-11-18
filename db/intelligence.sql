-- ================================================================
-- FLUXERA — Workflow + Tool Intelligence
-- Applied after schema.sql by db/migrate.js
-- ================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, name)
);

CREATE TABLE IF NOT EXISTS tools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price_default NUMERIC(10,6),
  recovery_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, name)
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  workflow_id   UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'success'
                  CHECK (status IN ('success', 'failed', 'partial')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  duration_ms   INTEGER,
  total_cost    NUMERIC(12,6) NOT NULL DEFAULT 0,
  failed_cost   NUMERIC(12,6) NOT NULL DEFAULT 0,
  retry_cost    NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executions_customer_time
  ON workflow_executions(customer_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_workflow
  ON workflow_executions(customer_id, workflow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS execution_steps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  execution_id   UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES execution_steps(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'success'
                   CHECK (status IN ('success', 'fail', 'cascade')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at       TIMESTAMPTZ,
  duration_ms    INTEGER,
  total_cost     NUMERIC(12,6) NOT NULL DEFAULT 0,
  failed_cost    NUMERIC(12,6) NOT NULL DEFAULT 0,
  retry_cost     NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_steps_execution
  ON execution_steps(execution_id, started_at ASC);

ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL;
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS step_id      UUID REFERENCES execution_steps(id) ON DELETE SET NULL;
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS tool_id      UUID REFERENCES tools(id) ON DELETE SET NULL;
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS attempt      INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_logs_execution
  ON request_logs(execution_id)
  WHERE execution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logs_step
  ON request_logs(step_id)
  WHERE step_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS recovery_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_id      UUID REFERENCES execution_steps(id) ON DELETE SET NULL,
  tool_id      UUID REFERENCES tools(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL DEFAULT 'recommended'
                 CHECK (kind IN ('recommended', 'executed')),
  action       TEXT NOT NULL,          -- retry | fallback | tool_down
  executed     TEXT,                   -- sdk_local | null (control plane later)
  result       TEXT,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_execution
  ON recovery_actions(execution_id, created_at DESC);

-- V2 durable approvals, human identities and restart-safe work queue.
ALTER TABLE recovery_actions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'recommended';
ALTER TABLE recovery_actions ADD COLUMN IF NOT EXISTS requested_action TEXT;
ALTER TABLE recovery_actions ADD COLUMN IF NOT EXISTS decision_by UUID;
ALTER TABLE recovery_actions ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ;
ALTER TABLE recovery_actions ADD COLUMN IF NOT EXISTS decision_reason TEXT;
ALTER TABLE recovery_actions ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recovery_actions ADD COLUMN IF NOT EXISTS action_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS workspace_memberships (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','approver','operator','viewer')),
  PRIMARY KEY(customer_id,user_id)
);
CREATE TABLE IF NOT EXISTS access_tokens (
  token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(), locked_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0, completed_at TIMESTAMPTZ, last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs(run_at) WHERE completed_at IS NULL;
CREATE TABLE IF NOT EXISTS execution_events (
  id BIGSERIAL PRIMARY KEY, customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL, kind TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(customer_id,request_id)
);
CREATE INDEX IF NOT EXISTS idx_execution_events_retention ON execution_events(created_at);
CREATE TABLE IF NOT EXISTS workspace_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL, company TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE workspace_users ADD COLUMN IF NOT EXISTS is_staff BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE workspace_applications ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE workspace_applications ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES workspace_users(id) ON DELETE SET NULL;
ALTER TABLE workspace_applications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE workspace_applications ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE workspace_applications ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_applications_pending_email
  ON workspace_applications (lower(email)) WHERE status = 'pending';

-- Phase 2
ALTER TABLE customers ADD COLUMN IF NOT EXISTS webhook_url TEXT;

ALTER TABLE execution_steps ADD COLUMN IF NOT EXISTS depends_on TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE execution_steps DROP CONSTRAINT IF EXISTS execution_steps_status_check;
ALTER TABLE execution_steps ADD CONSTRAINT execution_steps_status_check
  CHECK (status IN ('success', 'fail', 'cascade'));

CREATE INDEX IF NOT EXISTS idx_logs_tool
  ON request_logs(tool_id)
  WHERE tool_id IS NOT NULL;

-- Early V1 — work + cost recovery
ALTER TABLE customers ADD COLUMN IF NOT EXISTS interrupt_after_minutes INTEGER NOT NULL DEFAULT 15;

ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS recovery_of UUID REFERENCES workflow_executions(id) ON DELETE SET NULL;

ALTER TABLE execution_steps ADD COLUMN IF NOT EXISTS cursor TEXT;
ALTER TABLE execution_steps ADD COLUMN IF NOT EXISTS progress_done INTEGER;
ALTER TABLE execution_steps ADD COLUMN IF NOT EXISTS progress_total INTEGER;
ALTER TABLE execution_steps ADD COLUMN IF NOT EXISTS checkpoint_at TIMESTAMPTZ;

ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS cost_kind TEXT NOT NULL DEFAULT 'api';
ALTER TABLE request_logs DROP CONSTRAINT IF EXISTS request_logs_cost_kind_check;
ALTER TABLE request_logs ADD CONSTRAINT request_logs_cost_kind_check
  CHECK (cost_kind IN ('api', 'tool', 'model', 'compute', 'third_party', 'memory'));

-- One institute name → one fx_ key (email already unique).
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_institute
  ON customers (lower(company))
  WHERE company IS NOT NULL AND company <> '';

-- Agent intelligence: same catalog, three actors.
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT 'workflow';
ALTER TABLE workflows DROP CONSTRAINT IF EXISTS workflows_actor_check;
ALTER TABLE workflows ADD CONSTRAINT workflows_actor_check
  CHECK (actor IN ('workflow', 'agent', 'memory'));

-- Memory intelligence: a second execution linked to an agent. No query text or chunks.
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS for_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS for_step TEXT;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS hit_count INTEGER;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS recovery_request_id UUID;

CREATE INDEX IF NOT EXISTS idx_executions_for
  ON workflow_executions(for_execution_id)
  WHERE for_execution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executions_recovery_request
  ON workflow_executions(recovery_request_id)
  WHERE recovery_request_id IS NOT NULL;

ALTER TABLE request_logs DROP CONSTRAINT IF EXISTS request_logs_cost_kind_check;
ALTER TABLE request_logs ADD CONSTRAINT request_logs_cost_kind_check
  CHECK (cost_kind IN ('api', 'tool', 'model', 'compute', 'third_party', 'memory'));

-- =================================================================
-- V2 approval-gated continuity control plane
-- =================================================================
-- `customers` remains the workspace record for backwards compatibility.
-- Machine `fx_` keys authenticate ingestion only; no dashboard tables refer
-- to them. All dashboard actions must resolve a workspace membership.

CREATE TABLE IF NOT EXISTS dashboard_sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_user ON dashboard_sessions(user_id);

ALTER TABLE access_tokens ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES workspace_users(id) ON DELETE CASCADE;
ALTER TABLE access_tokens ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE access_tokens ADD COLUMN IF NOT EXISTS used_by_ip INET;

CREATE TABLE IF NOT EXISTS workspace_integrations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id               UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  webhook_url               TEXT NOT NULL,
  signing_secret            TEXT NOT NULL,
  supports_idempotency_key  BOOLEAN NOT NULL DEFAULT false,
  active                    BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, name),
  CHECK (webhook_url ~* '^https?://')
);

CREATE TABLE IF NOT EXISTS recovery_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  execution_id      UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  integration_id    UUID REFERENCES workspace_integrations(id) ON DELETE RESTRICT,
  source            TEXT NOT NULL CHECK (source IN ('failure', 'stall', 'manual')),
  action            TEXT NOT NULL CHECK (action IN ('retry', 'resume')),
  status            TEXT NOT NULL DEFAULT 'pending_approval'
                    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'dispatching', 'dispatched', 'delivery_failed', 'verified', 'verification_failed', 'expired')),
  action_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by      UUID REFERENCES workspace_users(id) ON DELETE SET NULL,
  approved_by       UUID REFERENCES workspace_users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  rejected_by       UUID REFERENCES workspace_users(id) ON DELETE SET NULL,
  rejected_at       TIMESTAMPTZ,
  decision_reason   TEXT,
  dispatch_attempts INTEGER NOT NULL DEFAULT 0,
  last_dispatched_at TIMESTAMPTZ,
  delivery_result   JSONB,
  verification_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  verified_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_workspace_status
  ON recovery_requests(customer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_execution
  ON recovery_requests(execution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recovery_audit_events (
  id                  BIGSERIAL PRIMARY KEY,
  recovery_request_id UUID NOT NULL REFERENCES recovery_requests(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  actor_user_id       UUID REFERENCES workspace_users(id) ON DELETE SET NULL,
  event_type          TEXT NOT NULL,
  details             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_audit_request ON recovery_audit_events(recovery_request_id, id);

-- Leases make the worker restart-safe: a new worker can reclaim jobs whose
-- lease has expired, while a live worker owns a job through its random token.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lease_token UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 8;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_jobs_claimable
  ON jobs(run_at, id) WHERE completed_at IS NULL AND failed_at IS NULL;

-- Durable event fan-out lets the API and the separate worker publish to the
-- same SSE stream without relying on in-memory process state.
CREATE TABLE IF NOT EXISTS workspace_events (
  id          BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workspace_events_stream
  ON workspace_events(customer_id, id DESC);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id   TEXT PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb
);
