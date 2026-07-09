# Curation — publishing to the Inspiration feed

The Inspiration segment of the Gallery is a sole-curator editorial feed. It is
served from `public/curated.json`, which ships with the GitHub Pages build.
Publishing is a commit; git is the backend.

## The publish loop (aim: under 5 minutes)

1. In the app, get the gradient you want on screen (Create tab).
2. Open the share menu (top-right) → **Copy as curated entry**. This copies a
   ready-to-paste JSON entry with `id` and `date` pre-filled.
3. Paste it into the array in `public/curated.json` (anywhere — the feed
   sorts newest-first by `date`).
4. Write the `note`: an IG-length caption in your voice. Why you picked it,
   how it feels. This is the editorial layer — don't skip it.
5. Commit and push. Pages redeploys; allow a few minutes for build + CDN.

## Rules of the file

- Entry shape: `{ id, note, date, gradient }` where `gradient` is the same
  wire shape as share links / JSON export (`SharePayloadGradient`). The
  display title is `gradient.name`.
- Invalid entries are skipped at load with a console warning — one bad paste
  never takes down the feed, but check the deployed site after publishing.
- The `sample-kiln-ember` entry is a placeholder; delete it once real picks
  exist. Seed ~20 entries before treating the feed as launched.
