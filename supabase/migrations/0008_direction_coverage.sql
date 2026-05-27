ALTER TABLE directions ADD COLUMN IF NOT EXISTS coverage_score numeric NULL;
ALTER TABLE directions ADD COLUMN IF NOT EXISTS closest_paper_ids text[] DEFAULT '{}'::text[];
