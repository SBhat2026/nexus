-- User-supplied cluster name. Takes precedence over the AI-generated `label`
-- everywhere a cluster is displayed. NULL = use the AI label.
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS custom_label text;
