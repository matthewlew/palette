# Changelog

All notable changes to this project during our sessions will be documented in this file.

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
