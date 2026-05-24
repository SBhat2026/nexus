-- Embedding cache: decoupled from sessions so popular papers are stored once
-- and reused across sessions rather than re-fetched from S2 every time.
create table embedding_cache (
  s2_paper_id    text primary key,
  title          text not null,
  abstract       text,
  authors        text[],
  year           integer,
  citation_count integer not null default 0,
  embedding      vector(768),
  tldr           text,
  cached_at      timestamptz not null default now()
);

-- Fast embedding lookup by vector similarity (used in Phase 3 cross-field expansion)
create index embedding_cache_embedding_idx on embedding_cache
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
