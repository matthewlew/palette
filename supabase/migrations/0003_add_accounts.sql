-- Accounts and attribution — step 1 of docs/accounts-and-attribution-plan.md.
--
-- Additive only. Nothing here changes existing `palettes` RLS or behaviour:
-- `author_id` is nullable and nothing reads or writes it yet. Auth itself
-- (anonymous bootstrap, sign-in) lands in the next step.

create extension if not exists citext;

-- One row per account, keyed by the same uuid as auth.users so it can never
-- drift from who Supabase thinks the user is.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     citext unique not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  constraint username_shape check (username ~ '^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$')
);

comment on table public.profiles is
  'One row per account. Username is the public byline on published gradients.';
comment on column public.profiles.username is
  'citext: case-insensitive and case-preserving. 3-20 chars, lowercase alnum + underscore, no leading/trailing underscore.';

-- Handles nobody gets to claim, checked by the same RPC that checks
-- availability so this is enforced, not just suggested.
create table if not exists public.reserved_usernames (
  username citext primary key
);

insert into public.reserved_usernames (username) values
  ('admin'), ('administrator'), ('root'), ('support'), ('help'),
  ('palette'), ('api'), ('about'), ('settings'), ('account'),
  ('login'), ('signin'), ('signup'), ('signout'), ('logout'),
  ('me'), ('you'), ('null'), ('undefined'), ('anonymous')
on conflict (username) do nothing;

alter table public.profiles enable row level security;

-- A byline is public by definition.
drop policy if exists "profiles readable by everyone" on public.profiles;
create policy "profiles readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles insertable by owner" on public.profiles;
create policy "profiles insertable by owner"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles updatable by owner" on public.profiles;
create policy "profiles updatable by owner"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No delete policy: account deletion cascades from auth.users, not from here.

-- Byline column on palettes. Nullable, `set null` (not cascade) so deleting
-- an account never deletes gradients other people saved and liked — the work
-- stays, the byline goes. Existing rows and RLS are untouched by this step.
alter table public.palettes
  add column if not exists author_id uuid references auth.users(id) on delete set null;

comment on column public.palettes.author_id is
  'Who published this gradient. Null = unattributed (legacy row, or unsigned). on delete set null: the gradient outlives the account.';

create index if not exists palettes_author_idx
  on public.palettes (author_id, created_at desc);

-- Saved palettes, server-side. Mirrors palette_likes' shape and RLS pattern.
-- The `palettes.id` type is read rather than guessed, same reasoning as
-- 0002_add_palette_likes.sql: a foreign key has to match exactly.
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
    create table if not exists public.palette_saves (
      user_id    uuid not null references auth.users(id) on delete cascade,
      palette_id %s not null references public.palettes(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, palette_id)
    )
  $fmt$, id_type);
end $$;

comment on table public.palette_saves is
  'A user''s saved shelf. Server-side source of truth; localStorage is a cache once the client reads from here.';

create index if not exists palette_saves_user_idx
  on public.palette_saves (user_id, created_at desc);

alter table public.palette_saves enable row level security;

drop policy if exists "palette_saves readable by owner" on public.palette_saves;
create policy "palette_saves readable by owner"
  on public.palette_saves for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "palette_saves insertable by owner" on public.palette_saves;
create policy "palette_saves insertable by owner"
  on public.palette_saves for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "palette_saves deletable by owner" on public.palette_saves;
create policy "palette_saves deletable by owner"
  on public.palette_saves for delete
  to authenticated
  using (user_id = auth.uid());
