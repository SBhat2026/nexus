-- Pre-flight: verify CASCADE on session_progress (only child table not in 0001_init)
ALTER TABLE session_progress
  DROP CONSTRAINT IF EXISTS session_progress_session_id_fkey,
  ADD CONSTRAINT session_progress_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'delete-stale-sessions',
  '*/5 * * * *',
  $$
    DELETE FROM sessions
    WHERE is_saved = false
      AND last_seen_at < now() - interval '10 minutes';
  $$
);
