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
  CHECK (cost_kind IN ('api', 'tool', 'model', 'compute', 'third_party'));

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

CREATE INDEX IF NOT EXISTS idx_executions_for
  ON workflow_executions(for_execution_id)
  WHERE for_execution_id IS NOT NULL;

ALTER TABLE request_logs DROP CONSTRAINT IF EXISTS request_logs_cost_kind_check;
ALTER TABLE request_logs ADD CONSTRAINT request_logs_cost_kind_check
  CHECK (cost_kind IN ('api', 'tool', 'model', 'compute', 'third_party', 'memory'));
