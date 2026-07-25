/**
 * Builds the share URL for a single published gradient.
 *
 * For now this is a working deep link into the app (`/palette/#<slug>`), which
 * the slug loader in App.tsx resolves to the exact gradient. It does NOT yet
 * produce a rich link-preview card — that needs per-slug OG pages served as
 * real HTML, which Supabase's function domain can't do (it forces text/plain).
 *
 * Rich previews are a follow-up: prerender `/palette/g/<slug>.html` into this
 * (project) repo's build output (vite `public/`) with OG tags whose og:image
 * points at the Supabase image function, then switch this helper to that path.
 */
export function previewShareUrl(slug: string): string {
  return `${window.location.origin}/palette/#${encodeURIComponent(slug)}`
}
