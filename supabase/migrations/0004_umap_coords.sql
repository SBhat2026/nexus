-- Add 2D UMAP projection coordinates to papers and clusters.
-- Computed at session create time (server-side) using jina-embeddings-v3 vectors.
-- NULL for sessions created before this migration; toggle is disabled client-side in that case.

alter table papers
  add column if not exists umap_x float,
  add column if not exists umap_y float;

alter table clusters
  add column if not exists umap_x float,
  add column if not exists umap_y float;
