-- WebExcels DRM Copilot V1 — core persistence
-- Additive only: conversations, messages, runs, tool calls, drafts, audit log,
-- and an action-proposal + execution ledger for the one optional write
-- (confirmed self-follow-up creation). Does NOT alter any existing table.
-- Safe to run repeatedly (IF NOT EXISTS throughout).
-- Status/role columns are plain text + CHECK constraints rather than native
-- Postgres enum types — see docs/copilot/PROGRESS.md M0 notes on why.

CREATE TABLE IF NOT EXISTS drm.copilot_conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES drm.users(id),
  title            text,
  created_at       timestamp DEFAULT now(),
  updated_at       timestamp DEFAULT now(),
  last_message_at  timestamp
);
CREATE INDEX IF NOT EXISTS idx_copilot_conv_user ON drm.copilot_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conv_last_msg ON drm.copilot_conversations (last_message_at);

CREATE TABLE IF NOT EXISTS drm.copilot_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES drm.copilot_conversations(id),
  run_id           uuid,
  role             text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content          text NOT NULL,
  created_at       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_msg_conv ON drm.copilot_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS drm.copilot_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES drm.copilot_conversations(id),
  user_id          uuid NOT NULL REFERENCES drm.users(id),
  status           text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','timeout')),
  model            text,
  tool_rounds      integer NOT NULL DEFAULT 0,
  input_tokens     integer,
  output_tokens    integer,
  error            text,
  started_at       timestamp DEFAULT now(),
  finished_at      timestamp
);
CREATE INDEX IF NOT EXISTS idx_copilot_run_conv ON drm.copilot_runs (conversation_id);
CREATE INDEX IF NOT EXISTS idx_copilot_run_user ON drm.copilot_runs (user_id);

CREATE TABLE IF NOT EXISTS drm.copilot_tool_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid NOT NULL REFERENCES drm.copilot_runs(id),
  tool_name        text NOT NULL,
  arguments        jsonb,
  result_summary   jsonb,
  scope_context    jsonb,
  status           text NOT NULL CHECK (status IN ('ok','error','denied')),
  error_message    text,
  created_at       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_toolcall_run ON drm.copilot_tool_calls (run_id);
CREATE INDEX IF NOT EXISTS idx_copilot_toolcall_name ON drm.copilot_tool_calls (tool_name);

CREATE TABLE IF NOT EXISTS drm.copilot_drafts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES drm.copilot_conversations(id),
  user_id          uuid NOT NULL REFERENCES drm.users(id),
  draft_type       text NOT NULL CHECK (draft_type IN ('followup_message','quotation_proposal','task_plan','internal_summary')),
  content          jsonb NOT NULL,
  source_refs      jsonb,
  missing_fields   jsonb,
  version          integer NOT NULL DEFAULT 1,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','discarded')),
  created_at       timestamp DEFAULT now(),
  updated_at       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_draft_conv ON drm.copilot_drafts (conversation_id);
CREATE INDEX IF NOT EXISTS idx_copilot_draft_user ON drm.copilot_drafts (user_id, status);

CREATE TABLE IF NOT EXISTS drm.copilot_audit_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id    uuid NOT NULL REFERENCES drm.users(id),
  effective_scope  jsonb,
  conversation_id  uuid,
  run_id           uuid,
  tool_name        text,
  target_type      text,
  target_id        text,
  action           text NOT NULL,
  outcome          text NOT NULL,
  source_refs      jsonb,
  model            text,
  usage            jsonb,
  created_at       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_audit_actor ON drm.copilot_audit_log (actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_copilot_audit_conv ON drm.copilot_audit_log (conversation_id);

-- Optional write (M4): a confirmed proposal, then an execution ledger with a
-- UNIQUE action_key and a UNIQUE proposal_id so retries/concurrent confirms
-- cannot create a second follow-up.
CREATE TABLE IF NOT EXISTS drm.copilot_action_proposals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id        uuid NOT NULL REFERENCES drm.copilot_conversations(id),
  user_id                uuid NOT NULL REFERENCES drm.users(id),
  action_type            text NOT NULL,
  payload                jsonb NOT NULL,
  payload_hash           text NOT NULL,
  target_record_version  text,
  status                 text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','executed','expired','cancelled','superseded')),
  expires_at             timestamp NOT NULL,
  created_at             timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_proposal_user ON drm.copilot_action_proposals (user_id, status);
CREATE INDEX IF NOT EXISTS idx_copilot_proposal_conv ON drm.copilot_action_proposals (conversation_id);

CREATE TABLE IF NOT EXISTS drm.copilot_action_executions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id        uuid NOT NULL UNIQUE REFERENCES drm.copilot_action_proposals(id),
  action_key         text NOT NULL UNIQUE,
  status             text NOT NULL CHECK (status IN ('success','failed','reconciling')),
  result_entity_type text,
  result_entity_id   text,
  error_message      text,
  executed_at        timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_exec_proposal ON drm.copilot_action_executions (proposal_id);
