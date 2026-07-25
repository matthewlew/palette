/**
 * Builds the rich-preview share URL for a single published gradient.
 *
 * Points at a prerendered static page on GitHub Pages
 * (`/palette/g/<slug>.html`). GitHub Pages serves it as real `text/html`, so
 * link crawlers in iMessage / Instagram DMs read its Open Graph tags and show
 * a rich card; the page then redirects humans on to the app at `#<slug>`.
 *
 * (The OG *image* those tags point to is rendered by the Supabase Edge
 * Function — Supabase serves image/png fine, it only blocks serving HTML.)
 *
 * These static pages are generated in batches (see the site repo's
 * scripts/gen-previews.mjs), so a freshly-created gradient may not have a
 * preview page until the next generation run; until then the link still
 * resolves to the app via the fallback below only if the page is missing.
 */
export function previewShareUrl(slug: string): string {
  return `${window.location.origin}/palette/g/${encodeURIComponent(slug)}.html`
}
