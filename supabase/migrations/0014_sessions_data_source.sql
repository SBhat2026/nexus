ALTER TABLE sessions ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'openalex';
