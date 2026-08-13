-- claim_username: the one write path onto profiles.username.
--
-- security definer so the profanity/reserved checks are actually enforced
-- server-side rather than merely suggested by the client — see
-- docs/accounts-and-attribution-plan.md §4. search_path is pinned for the
-- usual reason: a security definer function that resolves names through the
-- caller's search_path is a hole.
--
-- Insert-only, matching the copy in plan §12 ("You can't change it later"):
-- a uid that already has a profile gets a clear error, not a silent rename.
-- If renames are allowed later this function is where that decision lands.
create or replace function public.claim_username(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username citext := lower(trim(p_username));
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'username already set' using errcode = '23505';
  end if;

  if v_username !~ '^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$' then
    raise exception 'invalid username shape' using errcode = '22023';
  end if;

  if exists (select 1 from public.reserved_usernames r where r.username = v_username) then
    raise exception 'username reserved' using errcode = '23514';
  end if;

  -- Mirrors src/lib/profanity.ts's BAD_WORDS_REGEX. Kept in sync by hand —
  -- there is no shared source between SQL and TypeScript for this list.
  if v_username::text ~* 'f+u+c+k+|s+h+i+t+|b+i+t+c+h+|c+u+n+t+|a+s+s+h+o+l+e+|d+i+c+k+|p+u+s+s+y+|w+h+o+r+e+|s+l+u+t+|f+a+g+g+o+t+|n+i+g+g+e+r+|n+i+g+g+a+' then
    raise exception 'username not allowed' using errcode = '23514';
  end if;

  insert into public.profiles (id, username)
  values (auth.uid(), v_username)
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.claim_username(text) to authenticated;
