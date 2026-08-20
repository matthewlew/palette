-- Gallery.tsx's community feed has had a working-looking Delete action
-- since ?admin=true existed, but it never actually deleted anything:
-- `palettes` has RLS enabled with select/insert policies (0001, 0008) but
-- NO delete policy has ever existed for it, at any point in this table's
-- history. Postgres RLS defaults to deny-all for any command with no
-- matching policy, so every delete request — from any role, including the
-- app's own author — silently matched zero rows. PostgREST returns that as
-- a normal 200/204 with `error: null`, not a Postgres error, so the client
-- (src/hooks/useCommunityGradients.ts's deleteGradient) took the success
-- path, optimistically removed the tile from local state, and the
-- untouched row reappeared on the next fetch. This looked exactly like a
-- caching bug from the UI, but nothing was ever actually deleted.
--
-- Scoped to the author, mirroring palette_saves'/palette_likes' existing
-- ownership policies (0002, 0003): you can delete what you published.
-- This does NOT cover legacy/unattributed rows (author_id is null) —
-- `auth.uid() = author_id` is never true against a null column, by
-- design, the same reasoning 0003's own comment gives for author_id
-- being nullable in the first place. Those need a one-off service-role
-- cleanup (or a future admin-role policy), not a blanket "anyone can
-- delete anything" policy.
drop policy if exists "palettes deletable by owner" on public.palettes;
create policy "palettes deletable by owner"
  on public.palettes for delete
  to authenticated
  using (auth.uid() = author_id);
