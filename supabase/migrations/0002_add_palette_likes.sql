-- Anonymous likes for community palettes.
--
-- There are no accounts, so a like is attributed to a client id generated in
-- the browser and kept in localStorage. That is a *signal*, not an identity:
-- anyone who wants to forge one can, and nothing here pretends otherwise. It is
-- enough to rank the feed and to give a training signal, which is what it is
-- for. If likes ever need to be trustworthy, that needs auth, not more SQL.
--
-- Two pieces:
--   palette_likes  — one row per (palette, client). The append-only event log,
--                    which is the part worth modelling on: it keeps who and
--                    when, not just how many.
--   palettes.likes — a denormalised counter kept in sync by a trigger, so the
--                    feed can read counts in the same select it already makes
--                    instead of an aggregate per page.

-- The `palettes.id` type is whatever the original schema chose (uuid or
-- bigint). Read it rather than guess: a foreign key has to match exactly, and
-- guessing wrong fails the whole migration.
do $$
declare id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into id_type
    from pg_attribute a
   where a.attrelid = 'public.palettes'::regclass
     and a.attname = 'id'
     and a.attnum > 0
     and not a.attisdropped;

  if id_type is null then
    raise exception 'public.palettes has no id column';
  end if;

  execute format($fmt$
    create table if not exists public.palette_likes (
      palette_id %s not null references public.palettes(id) on delete cascade,
      client_id  text not null,
      created_at timestamptz not null default now(),
      primary key (palette_id, client_id)
    )
  $fmt$, id_type);
end $$;

comment on table public.palette_likes is
  'One row per (palette, anonymous client). Append-only signal, not an identity.';

-- Newest-first reads of one client's likes, and the counter backfill below.
create index if not exists palette_likes_client_idx
  on public.palette_likes (client_id, created_at desc);

alter table public.palettes
  add column if not exists likes integer not null default 0;

comment on column public.palettes.likes is
  'Cached count of palette_likes rows. Maintained by the palette_likes_sync trigger.';

-- security definer: anon may insert into palette_likes but must not be able to
-- update palettes directly, so the counter is bumped with the function owner's
-- rights. search_path is pinned for the usual reason — a security definer
-- function that resolves names through the caller's search_path is a hole.
create or replace function public.sync_palette_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.palettes set likes = likes + 1 where id = new.palette_id;
    return new;
  end if;
  -- greatest(0, ...) so a double-fire or a hand-run delete can never park the
  -- counter below zero, where it would render as a negative like count.
  update public.palettes set likes = greatest(0, likes - 1) where id = old.palette_id;
  return old;
end;
$$;

drop trigger if exists palette_likes_sync on public.palette_likes;
create trigger palette_likes_sync
  after insert or delete on public.palette_likes
  for each row execute function public.sync_palette_likes();

-- Recompute from the log so re-running this file is safe and so the counter is
-- correct even if rows were ever inserted with the trigger absent.
update public.palettes p
   set likes = coalesce((
         select count(*) from public.palette_likes l where l.palette_id = p.id
       ), 0)
 where p.likes is distinct from coalesce((
         select count(*) from public.palette_likes l where l.palette_id = p.id
       ), 0);

alter table public.palette_likes enable row level security;

drop policy if exists "palette_likes readable" on public.palette_likes;
create policy "palette_likes readable"
  on public.palette_likes for select
  to anon, authenticated
  using (true);

-- The client id is echoed in a request header (see src/lib/supabase.ts). Binding
-- the row to it stops one browser from writing likes under another browser's
-- id, and the primary key stops it from liking the same palette twice. Neither
-- is a defence against someone who edits their own header — see the note above.
drop policy if exists "palette_likes insertable by owner" on public.palette_likes;
create policy "palette_likes insertable by owner"
  on public.palette_likes for insert
  to anon, authenticated
  with check (client_id = current_setting('request.headers', true)::json->>'x-palette-client');

-- Unlike removes your own row only. Without this the delete policy would have
-- to be `using (true)`, which is a one-line script away from wiping the table.
drop policy if exists "palette_likes deletable by owner" on public.palette_likes;
create policy "palette_likes deletable by owner"
  on public.palette_likes for delete
  to anon, authenticated
  using (client_id = current_setting('request.headers', true)::json->>'x-palette-client');
