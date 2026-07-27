# Changelog

All notable changes to this project during our sessions will be documented in this file.

## [Unreleased] - 2026-07-27

### Changed
- **Angular honours stop positions** (reversal). Angular spread colours around the circle by index (`i/n`) and discarded positions outright, so dragging a stop emitted byte-identical CSS. Positions now scale by `(n-1)/n`, which reserves the seam its own `360/n` wedge — an evenly spaced ramp lands on exactly the old offsets, so the default is unchanged and only a deliberately uneven ramp differs. Hardened wedges track the same offsets. The original call was made to guarantee N colours read as N equal wedges; that reading survives the scaling, and the inert control did not justify keeping it.
- **Mirror honours stop positions** (reversal). Mirror normalised min–max onto a full 0–100 span before folding, which made it invariant to any shift or stretch of the ramp: `[0,50,100]`, `[10,50,90]` and `[30,65,100]` all produced identical CSS, so dragging either end stop was a no-op. Positions are now halved directly and reflected about the 50% line. A ramp already filling 0–100 is unchanged. The normalisation existed to stop a gap opening at the fold when no stop reached 100; that is now fixed by reflecting the fold stop instead of stretching the ramp to meet it, so a short ramp holds its last colour flat across the middle.
- **Turrell blocks travel nearly the full range.** The extent floor dropped from 0.2 to 0.1, so a stop moves across 90% of the range rather than 80% and the innermost block no longer sits at a fifth of the canvas. It stays well above zero on purpose: layers are blurred 24px by default, so 0.05 (tried, rejected) swallows the innermost colour completely.
- **Drift (the play button) now runs on angular**, which it could not before: every frame used to render identical CSS. Only `square` is still excluded, because Turrell blocks are painted by their own elements and a drifting background-image never reaches them.

### Fixed
- **Four copies of the same geometry, drifting apart.** `gradientColorAt`'s Turrell sampler computed `100 - position * 0.8`, inverting the ramp — it treated position 0 as the outermost layer where the component makes it the innermost, so on-gradient ink was picked against the wrong colour for any square with asymmetric stops. The PNG export compressed angular by `n/(n+1)`, agreeing with neither the CSS nor the sampler, so an exported angular PNG placed every stop differently from the gradient it came from. The export's mirror rebuilt an evenly spaced sequence from hex order, discarding positions. All of these now resolve through the shared `angularSequence` / `mirrorSequence` / `turrellExtent`.

## [Unreleased] - 2026-07-25

### Added
- **Batch Export**: Added an "Export Posts" button to the Gallery header that bundles all saved gradients into a downloadable ZIP file of 1080x1350 PNGs.
- **Instagram Poster Layout**: Added a `post` vignette shape to generate 1080x1350 images for social media sharing. 

### Changed
- **Share Menu Redesign**: Simplified the `BoardShare` dropdown to prioritize a one-tap "Share as Image" and "Copy Link" action, tucking developer/JSON tools behind a "More options •••" overflow menu.
- **Text Alignment**: Changed the poster export text to be left-aligned (6% margin) instead of center-aligned for a more editorial poster quality.
- **Dynamic Text Contrast**: Updated the `titleColorAt` coordinate to sample contrast from the left margin (0.06, 0.5) instead of the dead center (0.5, 0.5) so text remains legible over edge colors (e.g. Hot Terracotta).
- **Turrell Rendering Fix**: Switched Turrell squares from using `ctx.filter = 'blur()'` to `ctx.shadowBlur` during export to prevent rendering bugs on iOS Safari for large canvases.
- **Bug Fix**: Restored missing `index` mapping in `Gallery.tsx` that was causing the cascading animation delay to crash the gallery view.
