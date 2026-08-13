-- Which migrations has this database actually had run against it?
--
-- Migrations here are applied BY HAND (dashboard SQL editor, or `supabase db
-- push`), so the files in this repo say what *should* exist, never what does.
-- Nothing reconciles the two, and nothing complains: a missing table degrades
-- to an empty feed, a missing function to a failed RPC at the one moment a
-- user tries to use it. 0005 sat unapplied until someone pressed Claim and got
-- "Could not find the function public.claim_palettes".
--
-- Paste this into Dashboard → SQL Editor. Every row should read `ok`. Re-run
-- any file whose row reads `MISSING` — 0003 through 0008 are all idempotent
-- (`if not exists`, `create or replace`, `drop policy if exists`), so running
-- one that was already applied is a no-op.

with expected as (
  select * from (values
    ('0001', 'palettes.offsets',                  to_regclass('public.palettes') is not null
                                                   and exists (select 1 from information_schema.columns
                                                                where table_schema = 'public' and table_name = 'palettes'
                                                                  and column_name = 'offsets')),
    ('0002', 'palette_likes table',               to_regclass('public.palette_likes') is not null),
    ('0002', 'palettes.likes',                    exists (select 1 from information_schema.columns
                                                           where table_schema = 'public' and table_name = 'palettes'
                                                             and column_name = 'likes')),
    ('0003', 'profiles table',                    to_regclass('public.profiles') is not null),
    ('0003', 'reserved_usernames table',          to_regclass('public.reserved_usernames') is not null),
    ('0003', 'palette_saves table',               to_regclass('public.palette_saves') is not null),
    ('0003', 'palettes.author_id',                exists (select 1 from information_schema.columns
                                                           where table_schema = 'public' and table_name = 'palettes'
                                                             and column_name = 'author_id')),
    ('0004', 'claim_username(text)',              to_regprocedure('public.claim_username(text)') is not null),
    ('0005', 'claim_palettes(text[])',            to_regprocedure('public.claim_palettes(text[])') is not null),
    ('0006', 'palette_likes.user_id',             exists (select 1 from information_schema.columns
                                                           where table_schema = 'public' and table_name = 'palette_likes'
                                                             and column_name = 'user_id')),
    ('0006', 'palette_likes_user_unique index',   to_regclass('public.palette_likes_user_unique') is not null),
    ('0007', 'merge_anonymous_account(uuid)',     to_regprocedure('public.merge_anonymous_account(uuid)') is not null),
    ('0008', 'palettes SELECT for authenticated', exists (select 1 from pg_policy
                                                          where polrelid = 'public.palettes'::regclass
                                                            and polcmd = 'r'
                                                            and 'authenticated'::regrole = any(polroles)))
  ) as t(migration, object, present)
)
select migration,
       object,
       case when present then 'ok' else 'MISSING' end as status
  from expected
 order by migration, object;
