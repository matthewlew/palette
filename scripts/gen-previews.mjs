#!/usr/bin/env node
// Prerenders one static Open Graph page per gradient into public/g/<slug>.html.
// vite copies public/ into dist/, so these serve at /palette/g/<slug>.html as
// real text/html — link crawlers (iMessage, Instagram DMs, Slack) read the OG
// tags and show a rich card, then the page redirects humans to /palette/#<slug>.
// The og:image is rendered by the Supabase Edge Function.
//
// Run:  node scripts/gen-previews.mjs   (uses VITE_SUPABASE_* env, or .env.local)

import { mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Load VITE_SUPABASE_* from env, falling back to .env.local for local runs.
async function config() {
  let url = process.env.VITE_SUPABASE_URL
  let key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    try {
      const env = await readFile(join(root, '.env.local'), 'utf8')
      for (const line of env.split('\n')) {
        const m = line.match(/^([A-Z_]+)=(.*)$/)
        if (m?.[1] === 'VITE_SUPABASE_URL') url ||= m[2].trim()
        if (m?.[1] === 'VITE_SUPABASE_ANON_KEY') key ||= m[2].trim()
      }
    } catch { /* no .env.local in CI */ }
  }
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  return { url, key }
}

const APP_BASE = 'https://matthewlew.github.io/palette'

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function pageHtml({ slug, name, supabaseUrl }) {
  const title = esc(name || slug)
  const appUrl = `${APP_BASE}/#${encodeURIComponent(slug)}`
  const ogImage = `${supabaseUrl}/functions/v1/preview/og/${encodeURIComponent(slug)}.png`
  const desc = 'A gradient made in palette. Tap to open, remix, and share.'
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} · palette</title>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:image" content="${ogImage}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${appUrl}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${ogImage}"/>
<link rel="canonical" href="${appUrl}"/>
<meta http-equiv="refresh" content="0; url=${appUrl}"/>
<script>location.replace(${JSON.stringify(appUrl)})</script>
</head><body>Opening ${title}… <a href="${appUrl}">Open palette</a>.</body></html>
`
}

async function fetchAll({ url, key }) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(
      `${url}/rest/v1/palettes?select=slug,display_name&order=created_at.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + pageSize - 1}` } },
    )
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

const { url, key } = await config()
const rows = (await fetchAll({ url, key })).filter((r) => /^[a-z0-9-]+$/.test(r.slug || ''))

const outDir = join(root, 'public', 'g')
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

for (const r of rows) {
  await writeFile(join(outDir, `${r.slug}.html`), pageHtml({ slug: r.slug, name: r.display_name, supabaseUrl: url }))
}
console.log(`Wrote ${rows.length} preview page(s) to public/g/`)
