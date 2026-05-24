-- Jina jina-embeddings-v3 outputs 1024 dimensions; update all vector columns.
-- Safe to run on an empty database (no production data yet).

-- Drop existing ivfflat indexes before altering column types
drop index if exists papers_embedding_idx;
drop index if exists embedding_cache_embedding_idx;

-- Update column types
alter table papers
  alter column embedding type vector(1024)
  using embedding::text::vector(1024);

alter table clusters
  alter column center_embedding type vector(1024)
  using center_embedding::text::vector(1024);

alter table embedding_cache
  alter column embedding type vector(1024)
  using embedding::text::vector(1024);

-- Recreate ivfflat indexes for the new dimensions
create index papers_embedding_idx on papers
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index embedding_cache_embedding_idx on embedding_cache
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
