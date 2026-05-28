ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS sessions_last_seen_idx ON sessions(last_seen_at) WHERE is_saved = false;
