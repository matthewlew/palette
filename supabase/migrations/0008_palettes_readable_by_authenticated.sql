-- Let signed-in visitors read and publish palettes again.
--
-- REGRESSION FIX. The two policies on `palettes` predate this repo and were
-- scoped `to anon` alone, which was correct for as long as the app had no
-- sessions: PostgREST ran every request as `anon`, and both policies matched.
--
-- Anonymous sign-in (plan §1) changed the role, not the code. Every visitor
-- now carries a session, so the same requests arrive as `authenticated` —
-- which those policies do not name, so they stop matching. RLS answers a
-- non-matching SELECT with zero rows rather than an error, so the community
-- feed went empty and silent, and publishing began failing the same way.
--
-- The lesson worth keeping: enabling anonymous auth silently reclassifies
-- EVERY request in the app from `anon` to `authenticated`. Any policy naming
-- only `anon` becomes dead. Nothing in the client changed, and nothing threw.
--
-- Widening the existing policies rather than adding parallel `authenticated`
-- ones, so each command keeps a single policy to read and reason about.
-- Grants nothing new: `using (true)` was already true for anyone who asked.
do $$
begin
  if exists (
    select 1 from pg_policy
     where polrelid = 'public.palettes'::regclass
       and polname = 'Allow public read access'
  ) then
    alter policy "Allow public read access"
      on public.palettes to anon, authenticated;
  end if;

  if exists (
    select 1 from pg_policy
     where polrelid = 'public.palettes'::regclass
       and polname = 'Allow public insert access'
  ) then
    alter policy "Allow public insert access"
      on public.palettes to anon, authenticated;
  end if;
end $$;

-- Belt and braces for a database whose policies were named differently, or
-- dropped: without at least one matching SELECT policy the feed is empty, and
-- that is the failure this migration exists to prevent recurring.
do $$
begin
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.palettes'::regclass
       and polcmd = 'r'
       and 'authenticated'::regrole = any(polroles)
  ) then
    create policy "palettes readable by authenticated"
      on public.palettes for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.palettes'::regclass
       and polcmd = 'a'
       and 'authenticated'::regrole = any(polroles)
  ) then
    create policy "palettes insertable by authenticated"
      on public.palettes for insert
      to authenticated
      with check (true);
  end if;
end $$;

-- Note on UPDATE: there is deliberately still no update policy. Both writers
-- of author_id (claim_palettes, merge_anonymous_account) are security
-- definer and bypass RLS by design, so granting one here would only widen
-- what a client can rewrite directly.
