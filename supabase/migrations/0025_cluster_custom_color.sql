-- 0025: per-cluster color override.
-- Users can recolor a cluster from the side panel; custom_color (a hex string
-- like '#f59e0b') wins over the default cluster blue everywhere it's rendered.
-- NULL = use the default color.

alter table clusters add column if not exists custom_color text;
