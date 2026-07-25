#!/usr/bin/env node
// Backfill script: finds palettes with a missing/blank display_name or slug
// and names them from their colors using the same naming engine the app uses.
// New rows are already auto-named on insert, so this is a safety sweep for any
// legacy/empty rows.
//
// Needs the SERVICE ROLE key (bypasses RLS to update rows). Do NOT commit it.
//
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   npx tsx supabase/scripts/name-untitled.mjs            # dry run (default)
//   ... APPLY=1 npx tsx supabase/scripts/name-untitled.mjs   # actually write
//
// Uses `tsx` so it can import the app's TypeScript naming engine directly.
// Run from the palette repo root.

import { createClient } from '@supabase/supabase-js'
import { namePalette } from '../../src/lib/naming.ts'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.env.APPLY === '1'

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const db = createClient(url, key)

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const { data, error } = await db
  .from('palettes')
  .select('id,slug,display_name,colors')
  .or('display_name.is.null,display_name.eq.,slug.is.null,slug.eq.')

if (error) { console.error('Query failed:', error.message); process.exit(1) }

if (!data.length) {
  console.log('No untitled/empty rows. Database is clean.')
  process.exit(0)
}

console.log(`Found ${data.length} untitled row(s):`)
for (const row of data) {
  const hexes = Array.isArray(row.colors) ? row.colors : []
  let name
  try { name = namePalette(hexes) } catch { name = 'Untitled Palette' }
  let slug = slugify(name)
  console.log(`  ${row.id}  ->  "${name}"  (${slug})`)
  if (!APPLY) continue

  // Resolve slug collisions the same way publishPalette does.
  let attempt = 1, finalName = name
  while (true) {
    const { error: upErr } = await db
      .from('palettes')
      .update({ display_name: finalName, slug })
      .eq('id', row.id)
    if (!upErr) break
    if (upErr.code === '23505') { attempt++; finalName = `${name} ${attempt}`; slug = slugify(finalName); continue }
    console.error(`  ! failed ${row.id}:`, upErr.message); break
  }
}

console.log(APPLY ? 'Done (applied).' : '\nDry run — re-run with APPLY=1 to write.')
