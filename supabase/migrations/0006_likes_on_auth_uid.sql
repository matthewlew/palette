-- Likes move from a forgeable header to a signed JWT claim — accounts plan §2.
--
-- 0002 attributed a like to a client id the browser generated and echoed in a
-- request header, and said plainly that anyone who wanted to forge one could.
-- Every browser now has a real auth session, so `auth.uid()` replaces it.
--
-- Ships only AFTER anonymous sessions are live in production. Run before that
-- and the policies reject every write from a browser that has no session.

alter table public.palette_likes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

comment on column public.palette_likes.user_id is
  'Who liked this. Null on rows written before accounts, which keep their count and lose their owner.';

-- Legacy rows keep the client id they were written with; new rows do not need
-- one. The original primary key (palette_id, client_id) therefore cannot
-- stand, since client_id is about to be absent.
alter table public.palette_likes
  alter column client_id drop not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.palette_likes'::regclass
       and contype = 'p'
  ) then
    alter table public.palette_likes drop constraint palette_likes_pkey;
  end if;
end $$;

-- One like per palette per user, and the same guarantee for the legacy rows
-- that still have only a client id. Partial indexes rather than one primary
-- key, because each applies to a different half of the table.
create unique index if not exists palette_likes_user_unique
  on public.palette_likes (palette_id, user_id)
  where user_id is not null;

create unique index if not exists palette_likes_client_unique
  on public.palette_likes (palette_id, client_id)
  where client_id is not null;

create index if not exists palette_likes_user_idx
  on public.palette_likes (user_id, created_at desc);

-- Backfill where a mapping exists. It mostly will not — client ids were never
-- associated with a user — so most legacy rows keep their count and lose their
-- owner, which only means those browsers can no longer un-like.

drop policy if exists "palette_likes readable" on public.palette_likes;
create policy "palette_likes readable"
  on public.palette_likes for select
  to anon, authenticated
  using (true);

-- The header is gone. A like is now bound to the uid in the request's JWT,
-- which the client cannot mint.
drop policy if exists "palette_likes insertable by owner" on public.palette_likes;
create policy "palette_likes insertable by owner"
  on public.palette_likes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "palette_likes deletable by owner" on public.palette_likes;
create policy "palette_likes deletable by owner"
  on public.palette_likes for delete
  to authenticated
  using (user_id = auth.uid());
