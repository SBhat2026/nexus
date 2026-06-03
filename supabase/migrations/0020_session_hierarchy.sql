-- Hierarchical sessions: a "drill into cluster" spawns a child session linked to
-- its parent session and the cluster it was seeded from.
--
-- NOTE: parent_cluster_id is TEXT with no FK. The live clusters.id column holds
-- session-scoped text ids like '<session-uuid>-cluster-0' (see app/api/session/
-- create/route.ts), so a uuid FK to clusters(id) would not apply. This mirrors
-- directions.parent_cluster_id (migration 0006). parent_session_id is a valid
-- uuid FK because sessions.id is uuid.
alter table sessions
  add column if not exists parent_session_id uuid references sessions(id) on delete set null,
  add column if not exists parent_cluster_id  text,
  add column if not exists depth integer not null default 0;

create index if not exists sessions_parent
  on sessions(parent_session_id)
  where parent_session_id is not null;
