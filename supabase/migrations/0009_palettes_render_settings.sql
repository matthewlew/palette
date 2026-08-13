-- Persist how a gradient renders, not just what colours it holds.
--
-- `palettes` stored colors, offsets, shape and angle. Crop (circle/oval) and
-- the effect toggles — reversed, hard stops, repeat, smooth, prism — were
-- never sent, so anything that round-tripped through this table came back a
-- full-bleed rectangle with every effect off.
--
-- That was invisible while the shelf was local-only and the community feed was
-- the only reader. Server-side saves made it reachable on a person's own work:
-- signing out and back in rebuilds the shelf from these rows, so the crop went
-- with it.
--
-- One jsonb column rather than a column per toggle: nothing queries or sorts
-- by these, and the set grows with the render engine. Nullable, and null means
-- "all defaults" — which is exactly how every row published before today
-- already reads. See src/lib/renderSettings.ts for the shape and for the
-- validation on the way back in.
alter table public.palettes
  add column if not exists render jsonb;

comment on column public.palettes.render is
  'Render settings: crop, reversed, hardStops, repeatEnabled, smoothEnabled, prismEnabled, fanAnchor. Null = all defaults.';
