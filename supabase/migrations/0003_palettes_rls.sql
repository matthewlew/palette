alter table public.palettes enable row level security;

-- Anyone can read palettes (both search and community feed need this)
drop policy if exists "palettes readable" on public.palettes;
create policy "palettes readable"
  on public.palettes for select
  to anon, authenticated
  using (true);

-- Anyone can publish new palettes
drop policy if exists "palettes insertable" on public.palettes;
create policy "palettes insertable"
  on public.palettes for insert
  to anon, authenticated
  with check (true);

-- Explicitly missing delete/update policies means they are denied for all users
