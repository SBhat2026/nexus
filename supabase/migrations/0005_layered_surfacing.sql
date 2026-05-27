-- Support layered graph surfacing and cluster quality scores.
-- is_representative: marks the 3 papers shown when a cluster is first expanded.
-- cluster_quality: mean pairwise cosine similarity within the cluster (0–1).

alter table papers
  add column if not exists is_representative bool default false;

alter table clusters
  add column if not exists cluster_quality float;
