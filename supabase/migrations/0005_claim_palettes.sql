-- Claiming unsigned gradients — accounts plan §5.
--
-- The ~119 rows that predate accounts have no author. A signer whose browser
-- still holds a local copy of one can put their name on it.
--
-- This is a guess, not proof: two people who generated the same colours could
-- each hold a local copy, and the first to sign in wins. That is accepted in
-- the plan, and it is why the UI asks rather than acting silently. What makes
-- it *safe* is the where clause below, not the prompt: a row that already has
-- an author is never touched, so nothing can change hands.
--
-- The client sends row ids rather than colour DNA. Both are equally forgeable
-- — a caller can invent either — so the DNA carries no security the ids do
-- not, and matching in SQL would mean reconstructing the client's DNA string
-- from a jsonb column whose exact shape varies. The protection is
-- `author_id is null`, and that is unaffected by which one is sent.
create or replace function public.claim_palettes(p_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- A byline needs a name to show. Claiming before choosing a username would
  -- silently produce rows that are owned but still render unsigned.
  if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'no profile' using errcode = '23503';
  end if;

  -- `id::text` rather than a typed array: palettes.id is uuid in some
  -- deployments and bigint in others (see 0002's note), and a text comparison
  -- is correct for both. The row count here is small enough that losing the
  -- index is irrelevant.
  update public.palettes
     set author_id = auth.uid()
   where id::text = any(p_ids)
     and author_id is null;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

grant execute on function public.claim_palettes(text[]) to authenticated;
