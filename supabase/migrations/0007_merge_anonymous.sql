-- Folding an anonymous session into an account — accounts plan §6.
--
-- Linking Google keeps the same uid, so the ordinary path never needs this.
-- It exists for the one sequence where the uids differ: sign out, publish
-- something anonymously, sign back in. Those rows are stranded under a uid
-- nobody will ever authenticate as again, and the claim flow cannot reach them
-- either — their author_id is set, not null, so `claim_palettes` skips them.
--
-- Unlike claiming, this is not a guess. Claiming infers ownership from a
-- colour match and therefore asks; here the browser genuinely held that
-- session, so the work is already the caller's and merging is bookkeeping.
--
-- SECURITY. The caller proves nothing about the anonymous uid beyond knowing
-- it, so this is bearer-secret protection: an unguessable v4 uuid, held only
-- by the browser that owned it. The guards below cap what that buys —
-- the target must still be anonymous and must never have claimed a username,
-- so a named account can never be absorbed, and the most an attacker could
-- reach by guessing a uuid is one anonymous session's unsigned work. That is
-- a deliberate trade: the alternative is stranding the rows forever, since
-- after sign-out there is no longer any way to prove the session was yours.
create or replace function public.merge_anonymous_account(p_anon_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- The linkIdentity path lands here with the same uid on both sides. Nothing
  -- to do, and self-merging the join tables below would be a no-op at best.
  if p_anon_id = auth.uid() then
    return 0;
  end if;

  -- Refuse anything that is not a live anonymous session. Both halves matter:
  -- is_anonymous stops a real account being absorbed, and the profiles check
  -- stops one that has already chosen a username, which is the point at which
  -- an account stops being disposable.
  if not exists (
    select 1 from auth.users u
     where u.id = p_anon_id
       and u.is_anonymous
  ) then
    raise exception 'not an anonymous account' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.id = p_anon_id) then
    raise exception 'account has a username' using errcode = '42501';
  end if;

  update public.palettes
     set author_id = auth.uid()
   where author_id = p_anon_id;

  get diagnostics v_moved = row_count;

  -- Drop the overlaps before moving the rest: both join tables are unique on
  -- (palette_id, user_id), so a palette saved (or liked) under both uids would
  -- collide. The account's own row is the one that survives.
  delete from public.palette_saves s
   where s.user_id = p_anon_id
     and exists (
       select 1 from public.palette_saves mine
        where mine.user_id = auth.uid()
          and mine.palette_id = s.palette_id
     );

  update public.palette_saves
     set user_id = auth.uid()
   where user_id = p_anon_id;

  delete from public.palette_likes l
   where l.user_id = p_anon_id
     and exists (
       select 1 from public.palette_likes mine
        where mine.user_id = auth.uid()
          and mine.palette_id = l.palette_id
     );

  update public.palette_likes
     set user_id = auth.uid()
   where user_id = p_anon_id;

  return v_moved;
end;
$$;

grant execute on function public.merge_anonymous_account(uuid) to authenticated;
