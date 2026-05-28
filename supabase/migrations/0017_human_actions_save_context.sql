ALTER TABLE human_actions DROP CONSTRAINT IF EXISTS human_actions_action_type_check;
ALTER TABLE human_actions ADD CONSTRAINT human_actions_action_type_check
  CHECK (action_type IN ('prune', 'flag', 'annotate', 'expand', 'reframe', 'generate', 'select', 'read', 'save_context'));

ALTER TABLE human_actions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE human_actions ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS human_actions_session_context_idx
  ON human_actions(session_id, action_type)
  WHERE deleted_at IS NULL;
