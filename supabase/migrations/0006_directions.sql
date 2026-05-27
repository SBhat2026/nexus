create table if not exists directions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  parent_cluster_id text,
  title text not null,
  description text,
  rationale text,
  novelty_score integer,
  feasibility_score integer,
  suggested_next_steps jsonb default '[]',
  is_flagged boolean default false,
  human_rating integer,
  created_at timestamptz default now()
);

create index if not exists directions_session_id_idx on directions(session_id);
