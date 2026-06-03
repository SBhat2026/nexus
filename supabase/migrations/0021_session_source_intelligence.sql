-- Source Intelligence: per-session record of how papers were sourced — detected
-- academic domain, ambiguous-term resolutions, the sub-queries actually run, and
-- the relevance-filter outcome. Surfaced in the Zone A "Source Intelligence" panel
-- and used by the "wrong domain? correct it" re-run flow. Stored as jsonb so the
-- shape can evolve without further migrations.
alter table sessions
  add column if not exists source_intelligence jsonb default '{}'::jsonb;
