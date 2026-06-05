-- One-time cleanup: strip raw HTML tags (<i>, <sub>, <sup>, <scp>, …) that OpenAlex
-- sometimes embeds in titles. New ingestion is sanitized in code (lib/sanitize.ts);
-- this fixes rows already stored. Tag-only strip (entities are rare in titles).
UPDATE papers
SET title = btrim(regexp_replace(title, '<[^>]+>', '', 'g'))
WHERE title ~ '<[^>]+>';
