/**
 * Builds the rich-preview share URL for a single published gradient.
 *
 * This points at the Supabase `preview` Edge Function (not the app directly),
 * so link crawlers in iMessage / Instagram DMs get per-gradient Open Graph
 * tags and a generated preview image. The function 302s humans on to the app
 * at `${APP}/#<slug>`, so the recipient still lands in palette.
 *
 * Derives the function base from VITE_SUPABASE_URL
 * (https://<ref>.supabase.co -> https://<ref>.supabase.co/functions/v1).
 */
export function previewShareUrl(slug: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
  if (!base) {
    // No Supabase configured: fall back to a plain app slug link (no preview).
    return `${window.location.origin}${window.location.pathname}#${slug}`
  }
  return `${base}/functions/v1/preview/g/${encodeURIComponent(slug)}`
}
