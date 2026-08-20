-- Sub-classifies 'order' and 'spacing' controlled-variant votes (see
-- 0011_gradient_votes_test_type.sql) by which SPECIFIC composition rule
-- produced the mutation, rather than lumping every reorder/respace under
-- one undifferentiated bucket. Reviewing live votes surfaced several
-- distinct, mechanism-level theories (e.g. "a neutral stop should get
-- more room between saturated neighbors" vs "one dominant light band
-- beats several small ones") that a single random-shuffle/random-respace
-- test can't tell apart — this column lets the recalibration script
-- report a separate win rate per theory instead of one blended number.
alter table public.gradient_votes
  add column if not exists strategy text;

comment on column public.gradient_votes.strategy is
  'Sub-variant within test_type ''order''/''spacing''/''symmetry'' — e.g. light-center, buffer-neutral, dominant-band, mirror. See src/lib/gradientComposition.ts. Null for every other test_type.';
