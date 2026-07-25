-- Adds persisted stop offset positions so gradients with uneven stop spacing
-- reproduce exactly on load. Aligned index-for-index with the `colors` array.
-- Nullable: existing rows fall back to even spacing in the app.
alter table public.palettes
  add column if not exists offsets jsonb;

comment on column public.palettes.offsets is
  'Stop offset positions 0-100, aligned to colors[]. Null = evenly spaced.';
