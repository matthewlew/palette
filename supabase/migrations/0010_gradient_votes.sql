-- Store manual A/B preference picks between two gradients, so scoring
-- weights in src/lib/paletteScore.ts can eventually be recalibrated
-- against real taste data instead of a one-time blind-ranking exercise
-- (see docs/superpowers/specs/2026-07-08-aesthetic-gradient-scoring-design.md).
--
-- `winner`/`loser` store a full snapshot of the picked gradient (colors,
-- offsets, shape) rather than just a `palette_id` FK: half the pairs shown
-- during voting are ephemerally generated and never saved anywhere, and a
-- community gradient can be edited or deleted after being voted on. A vote
-- should stay meaningful either way.
--
-- Scoped to the voting user like `palette_likes` (migration 0006): every
-- visitor carries a real session (anonymous sign-in), so `auth.uid()` is a
-- stable, unforgeable identity even without a separate admin/role concept.
create table public.gradient_votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  voter_id uuid not null references auth.users(id),
  winner jsonb not null,
  loser jsonb not null,
  category text,
  note text
);

comment on column public.gradient_votes.winner is
  'Snapshot of the picked gradient at vote time: { source: "community"|"generated", paletteId?, colors, offsets, shape }.';
comment on column public.gradient_votes.loser is
  'Same shape as winner, for the gradient that was not picked.';
comment on column public.gradient_votes.category is
  'Optional id from src/lib/gradientCategories.ts, tagged manually during voting.';
comment on column public.gradient_votes.note is
  'Optional free-text note, either typed directly or produced by the chat annotation panel.';

alter table public.gradient_votes enable row level security;

create policy "gradient_votes readable by owner"
  on public.gradient_votes for select
  to authenticated
  using (auth.uid() = voter_id);

create policy "gradient_votes insertable by owner"
  on public.gradient_votes for insert
  to authenticated
  with check (auth.uid() = voter_id);
