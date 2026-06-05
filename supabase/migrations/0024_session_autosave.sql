-- Soft-delete marker so /sessions can hide removed sessions (is_saved + deleted_at IS NULL).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Denormalized convenience cache for incremental auto-save: the chat transcript has
-- no normalized home, so it lives here. Cluster labels / directions / pruning remain
-- authoritative in their own tables; this column only carries chat history.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS chat_history jsonb NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS sessions_saved_updated_idx
  ON sessions(user_id, updated_at DESC)
  WHERE is_saved = true AND deleted_at IS NULL;
