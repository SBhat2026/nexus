alter table papers
  add column if not exists nearest_cluster_id text null;
