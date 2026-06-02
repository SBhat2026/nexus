-- ─── session_snapshots ───────────────────────────────────────────────────────
-- Immutable, versioned checkpoints of a session's full graph state. Supports
-- branching (parent_version) so reverting to an old snapshot and continuing forks
-- a new line of history rather than destroying the existing one.
--
-- `graph` holds the full GraphData JSON ({ nodes, edges }) as held by the client at
-- checkpoint time. Curation (prune/flag) is reconciled to human_actions on revert;
-- the normalized tables remain the source of truth for a cold DB reload.

create table if not exists session_snapshots (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  version        integer not null,            -- monotonic per session, 1-based
  parent_version integer,                     -- null for the root; set on branch/revert
  label          text,                        -- user label or auto reason ("before prune", etc.)
  origin         text not null default 'manual'
                   check (origin in ('manual','auto','revert','initial')),
  graph          jsonb not null,              -- full { nodes, edges }
  node_count     integer not null default 0,
  edge_count     integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (session_id, version)
);

create index if not exists session_snapshots_session_idx
  on session_snapshots(session_id, version desc);
