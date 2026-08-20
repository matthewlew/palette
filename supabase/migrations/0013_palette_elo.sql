-- Persistent Elo rating for community palettes, updated from head-to-head
-- 'community' votes in gradient_votes (see src/components/GradientVote.tsx
-- — the only test type that pairs two DIFFERENT saved palettes against each
-- other; every other test type compares against a generated or mutated
-- candidate that isn't itself a real, independently-rankable palette, so
-- only 'community' rows move a rating). This is what backs the top-100
-- leaderboard + rank/trend view (?leaderboard=true).
--
-- Two pieces, same shape as palette_likes' counter + event-log split
-- (migration 0002):
--   palettes.elo_rating    — the current rating, read directly by the
--                            leaderboard's sort.
--   palette_elo_history    — one row per rating change, so a palette's
--                            trend (up/down over the last N days) can be
--                            computed without recomputing all of Elo.

alter table public.palettes
  add column if not exists elo_rating integer not null default 1200,
  add column if not exists elo_updated_at timestamptz;

comment on column public.palettes.elo_rating is
  'Elo rating from head-to-head gradient_votes rows where test_type = ''community''. Starts at 1200 for every palette.';

create table if not exists public.palette_elo_history (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  elo_rating integer not null,
  created_at timestamptz not null default now()
);

comment on table public.palette_elo_history is
  'One row per Elo rating change for a palette, written by apply_gradient_vote_elo. Powers the leaderboard trend indicator.';

create index if not exists palette_elo_history_palette_id_idx
  on public.palette_elo_history (palette_id, created_at);

-- security definer: the voting client only has RLS permission to insert
-- into gradient_votes, not to write palettes/palette_elo_history directly —
-- same justification as claim_username (0004) and merge_anonymous_account
-- (0007). search_path is pinned per the usual security-definer rule.
create or replace function public.apply_gradient_vote_elo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  winner_id uuid := (new.winner->>'paletteId')::uuid;
  loser_id  uuid := (new.loser->>'paletteId')::uuid;
  winner_elo int;
  loser_elo int;
  expected_winner numeric;
  k constant int := 32;
begin
  if new.test_type is distinct from 'community' or winner_id is null or loser_id is null then
    return new;
  end if;

  select elo_rating into winner_elo from public.palettes where id = winner_id;
  select elo_rating into loser_elo from public.palettes where id = loser_id;
  if winner_elo is null or loser_elo is null then
    return new;
  end if;

  expected_winner := 1.0 / (1.0 + power(10.0, (loser_elo - winner_elo) / 400.0));
  winner_elo := round(winner_elo + k * (1 - expected_winner));
  loser_elo := round(loser_elo + k * (0 - (1 - expected_winner)));

  update public.palettes set elo_rating = winner_elo, elo_updated_at = now() where id = winner_id;
  update public.palettes set elo_rating = loser_elo, elo_updated_at = now() where id = loser_id;

  insert into public.palette_elo_history (palette_id, elo_rating)
  values (winner_id, winner_elo), (loser_id, loser_elo);

  return new;
end;
$$;

drop trigger if exists gradient_votes_apply_elo on public.gradient_votes;
create trigger gradient_votes_apply_elo
  after insert on public.gradient_votes
  for each row execute function public.apply_gradient_vote_elo();

alter table public.palette_elo_history enable row level security;

-- Readable by anyone, like palettes itself (0008) — the leaderboard and its
-- trend indicator have to work for a visitor who isn't signed in.
drop policy if exists "palette_elo_history readable" on public.palette_elo_history;
create policy "palette_elo_history readable"
  on public.palette_elo_history for select
  to anon, authenticated
  using (true);
