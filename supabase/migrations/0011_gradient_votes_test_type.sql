-- Support controlled-variant A/B tests (?vote=true), not just independent
-- random pairs. A round can now hold the same color set fixed and mutate
-- ONE property of it for the second candidate — one fewer stop, a
-- different color order, a different shape, or different stop spacing —
-- so scoring can eventually be based on which specific properties a
-- gradient's stops present, not just re-weighted global heuristics.
--
-- test_type: null for the original "independent random pair, shared
-- shape" mode; one of 'stops' | 'order' | 'shape' | 'spacing' when a round
-- is a controlled base-vs-mutated comparison.
alter table public.gradient_votes
  add column if not exists test_type text;

comment on column public.gradient_votes.test_type is
  'null = independent random pair (original mode). Otherwise the single property mutated between winner/loser: stops (one fewer), order (color order), shape (geometry), spacing (stop positions). winner/loser jsonb also carries a "variant": "base"|"mutated" field for these.';
