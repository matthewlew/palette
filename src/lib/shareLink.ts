/**
 * Builds the rich-preview share URL for a single published gradient.
 *
 * Points at a prerendered static page (`/palette/g/<slug>.html`) served by this
 * repo's GitHub Pages build as real text/html — so link crawlers in iMessage /
 * Instagram DMs read its Open Graph tags and show a rich card (gradient image +
 * name). The page then redirects humans on to the app at `#<slug>`.
 *
 * The OG image itself is rendered by the Supabase Edge Function (Supabase
 * serves image/png fine; it only refuses to serve HTML). Preview pages are
 * regenerated in batches by scripts/gen-previews.mjs (a cron + each deploy);
 * a gradient shared before its page exists is caught by public/404.html, which
 * still redirects the visitor into the app at the right slug.
 */
export function previewShareUrl(slug: string): string {
  return `${window.location.origin}/palette/g/${encodeURIComponent(slug)}.html`
}
