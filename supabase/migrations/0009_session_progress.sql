CREATE TABLE IF NOT EXISTS session_progress (
  session_id uuid PRIMARY KEY,
  stage text NOT NULL,
  stage_index integer NOT NULL,
  stage_total integer NOT NULL DEFAULT 6,
  detail text,
  error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
