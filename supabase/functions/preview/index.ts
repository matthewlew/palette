// Rich-preview Edge Function for palette gradients.
//
// Two routes (crawlers hit the first, which points og:image at the second):
//   GET /preview/g/:slug        -> HTML page with Open Graph / Twitter meta
//                                  tags + a redirect so humans land in the app
//   GET /preview/og/:slug.png   -> 1200x630 PNG rendering of the gradient
//
// Deploy:  supabase functions deploy preview --no-verify-jwt
// (must be public / no JWT so link crawlers can fetch it)
//
// Set the app URL the human redirect targets:
//   supabase secrets set APP_BASE_URL=https://matthewlew.github.io/palette
//
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2'

// resvg needs its wasm initialised once per isolate.
let wasmReady: Promise<void> | null = null
function ensureWasm() {
  if (!wasmReady) {
    wasmReady = fetch(
      'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
    ).then((r) => r.arrayBuffer()).then((buf) => initWasm(buf))
  }
  return wasmReady
}

// resvg's wasm sandbox has no system fonts, so <text> renders nothing unless
// we hand it a font buffer. Fetch a bold sans once per isolate.
const FONT_URL = 'https://cdn.jsdelivr.net/gh/googlefonts/roboto-2@main/src/hinted/Roboto-Bold.ttf'
let fontReady: Promise<Uint8Array> | null = null
function ensureFont() {
  if (!fontReady) {
    fontReady = fetch(FONT_URL)
      .then((r) => r.arrayBuffer())
      .then((buf) => new Uint8Array(buf))
      .catch(() => new Uint8Array()) // fall back to no text rather than 500
  }
  return fontReady
}

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://matthewlew.github.io/palette'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
)

interface Row {
  slug: string
  display_name: string
  colors: string[]
  shape: string
  angle: number | null
  offsets: number[] | null
}

function safeHex(hex: string): string {
  const clean = (hex || '').replace(/[^#0-9a-fA-F]/g, '')
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(clean) ? clean : '#888888'
}

function esc(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}

// Build an 1200x630 SVG. Offsets default to even spacing; angle rotates the
// linear axis; radial uses a centered circle. Other geometries approximate
// as linear (SVG has no conic gradient) — good enough for a link thumbnail.
function buildSvg(row: Row): string {
  const w = 1200, h = 630
  const colors = (row.colors?.length ? row.colors : ['#888', '#333']).map(safeHex)
  const n = colors.length
  const offsets = Array.isArray(row.offsets) && row.offsets.length === n
    ? row.offsets
    : colors.map((_, i) => (n === 1 ? 0 : Math.round((i / (n - 1)) * 100)))
  const stops = colors
    .map((hex, i) => `<stop offset="${offsets[i]}%" stop-color="${hex}"/>`)
    .join('')

  // NOTE the `?? null`, not `?? 0`: the app treats a null angle as CENTRE and 0
  // as TOP. Coercing here re-anchors every centred gradient to the top edge.
  // Mirrors getRadialConfig in src/lib/gradient.ts.
  const rawAngle = row.angle ?? null
  const origin = radialOrigin(rawAngle)
  const angle = ((rawAngle ?? 0) % 360 + 360) % 360

  const title = esc(row.display_name || 'palette')
  const shadow = `<filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.45"/>
      </filter>`
  const label = `<text x="60" y="${h - 60}" font-family="Roboto"
      font-size="56" font-weight="700" fill="#ffffff" filter="url(#sh)">${title}</text>`

  // Turrell squares are nested rects, not a gradient — rendering them as a
  // linear ramp made the single most visually distinctive shape unrecognisable
  // in link previews. SVG does this natively; only conic genuinely can't be done.
  if (row.shape === 'square') {
    const reachX = Math.max(origin.px, 1 - origin.px)
    const reachY = Math.max(origin.py, 1 - origin.py)
    const cx = origin.px * w
    const cy = origin.py * h
    const layers = colors
      .map((hex, i) => ({ hex, factor: n <= 1 ? 1 : 0.2 + (offsets[i] / 100) * 0.8 }))
      .sort((a, b) => b.factor - a.factor) // largest first
    const rects = layers.map(({ hex, factor }) => {
      const rw = 2 * reachX * factor * w
      const rh = 2 * reachY * factor * h
      return `<rect x="${(cx - rw / 2).toFixed(1)}" y="${(cy - rh / 2).toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${hex}"/>`
    }).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>${shadow}
      <filter id="turrell" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="38"/>
      </filter>
    </defs>
    <rect width="${w}" height="${h}" fill="${layers[0]?.hex ?? '#333'}"/>
    <g filter="url(#turrell)">${rects}</g>
    ${label}
  </svg>`
  }

  const def = row.shape === 'radial'
    // Origin honoured rather than pinned to the centre. r grows with the reach
    // so an edge/corner origin still covers the far side.
    ? `<radialGradient id="g" cx="${origin.px}" cy="${origin.py}" r="${(0.6 * Math.max(Math.max(origin.px, 1 - origin.px), Math.max(origin.py, 1 - origin.py)) / 0.5).toFixed(3)}">${stops}</radialGradient>`
    // gradientTransform rotates the default top->bottom axis about the center.
    // angular/fan/mirror/repeat still approximate as linear: SVG has no conic
    // gradient, and the rest are close enough at thumbnail size.
    : `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1" gradientTransform="rotate(${angle} 0.5 0.5)">${stops}</linearGradient>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>${def}${shadow}</defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    ${label}
  </svg>`
}

/** The 8-way origin mapping, mirroring getRadialConfig in src/lib/gradient.ts.
 *  null/undefined is CENTRE; 0 is TOP. They are different origins. */
function radialOrigin(angle: number | null): { px: number; py: number } {
  if (angle == null) return { px: 0.5, py: 0.5 }
  switch ((Math.round(angle / 45) * 45) % 360) {
    case 0: return { px: 0.5, py: 0 }
    case 45: return { px: 1, py: 0 }
    case 90: return { px: 1, py: 0.5 }
    case 135: return { px: 1, py: 1 }
    case 180: return { px: 0.5, py: 1 }
    case 225: return { px: 0, py: 1 }
    case 270: return { px: 0, py: 0.5 }
    case 315: return { px: 0, py: 0 }
    default: return { px: 0.5, py: 0.5 }
  }
}

async function fetchRow(slug: string): Promise<Row | null> {
  const { data, error } = await supabase
    .from('palettes')
    .select('slug,display_name,colors,shape,angle,offsets')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return data as Row
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  // Path after the function name, e.g. /preview/g/sunset -> ['g','sunset']
  const parts = url.pathname.split('/').filter(Boolean)
  const fnIdx = parts.indexOf('preview')
  const route = fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts
  const kind = route[0]
  const slug = decodeURIComponent((route[1] || '').replace(/\.png$/, ''))

  if (!slug) return new Response('Not found', { status: 404 })

  const row = await fetchRow(slug)
  if (!row) return new Response('Gradient not found', { status: 404 })

  if (kind === 'og') {
    await ensureWasm()
    const font = await ensureFont()
    const png = new Resvg(buildSvg(row), {
      fitTo: { mode: 'width', value: 1200 },
      font: { fontBuffers: font.length ? [font] : [], defaultFontFamily: 'Roboto' },
    }).render().asPng()
    return new Response(png, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=86400, s-maxage=604800',
      },
    })
  }

  // Default: the HTML share page with OG tags + redirect to the app.
  // Build the image URL from the public project URL (not url.origin, which
  // behind the edge proxy drops the /functions/v1/preview prefix and can come
  // through as http). Crawlers must be able to fetch this absolute https URL.
  const fnBase = (Deno.env.get('SUPABASE_URL') ?? url.origin).replace(/\/$/, '')
  const ogImage = `${fnBase}/functions/v1/preview/og/${encodeURIComponent(row.slug)}.png`
  const appUrl = `${APP_BASE_URL}/#${encodeURIComponent(row.slug)}`
  const title = esc(row.display_name || 'palette')
  const desc = 'A gradient made in palette. Tap to open, remix, and share.'

  const html = `<!doctype html>
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
</head><body>Opening ${title}… <a href="${appUrl}">Open palette</a>.</body></html>`

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600',
    },
  })
})
