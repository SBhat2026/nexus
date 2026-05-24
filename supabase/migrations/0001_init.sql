-- Enable pgvector extension
create extension if not exists vector;

-- ─── sessions ────────────────────────────────────────────────────────────────
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  seed_topic    text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── papers ──────────────────────────────────────────────────────────────────
create table papers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  s2_paper_id    text not null,
  title          text not null,
  abstract       text,
  authors        text[],
  year           integer,
  citation_count integer not null default 0,
  embedding      vector(768),
  cluster_id     uuid,
  is_outlier     boolean not null default false,
  tldr           text,
  pdf_url        text,
  s2_url         text
);

create index papers_session_idx on papers(session_id);
create index papers_cluster_idx on papers(cluster_id);
-- ivfflat index for ANN search (used in Phase 2+ similarity queries)
create index papers_embedding_idx on papers
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ─── clusters ────────────────────────────────────────────────────────────────
create table clusters (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions(id) on delete cascade,
  label            text not null,
  description      text,
  center_embedding vector(768),
  paper_count      integer not null default 0,
  field            text,
  is_pruned        boolean not null default false,
  prune_reason     text
);

create index clusters_session_idx on clusters(session_id);

-- ─── direction_nodes ─────────────────────────────────────────────────────────
create table direction_nodes (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references sessions(id) on delete cascade,
  title              text not null,
  description        text,
  novelty_score      smallint check (novelty_score between 1 and 10),
  feasibility_score  smallint check (feasibility_score between 1 and 10),
  parent_cluster_id  uuid references clusters(id),
  is_flagged         boolean not null default false,
  human_rating       smallint check (human_rating between 1 and 5),
  rationale          text,
  suggested_next_steps text[]
);

create index direction_nodes_session_idx on direction_nodes(session_id);

-- ─── edges ───────────────────────────────────────────────────────────────────
create table edges (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  source_id    text not null,
  source_type  text not null,
  target_id    text not null,
  target_type  text not null,
  weight       real not null default 1.0,
  edge_type    text not null check (edge_type in ('citation', 'semantic_similarity', 'generated_from'))
);

create index edges_session_idx on edges(session_id);
create index edges_source_idx on edges(session_id, source_id);

-- ─── human_actions ───────────────────────────────────────────────────────────
create table human_actions (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  action_type  text not null check (action_type in ('prune', 'flag', 'annotate', 'expand', 'reframe', 'generate', 'select')),
  target_id    text not null,
  target_type  text not null,
  note         text,
  created_at   timestamptz not null default now()
);

create index human_actions_session_idx on human_actions(session_id);
