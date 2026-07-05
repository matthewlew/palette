# Reference notes: Edit Mode mockup (2026-07-05)

User shared a mockup screenshot for the Edit Mode sub-project (not yet spec'd —
Edit Mode is currently stubbed in the exploration-screen spec). Captured here as
input for when that sub-project is brainstormed.

## What the mockup shows

- **Browse screen**: full-bleed vertical gradient, matches current exploration
  screen design (linear, radial, angular/conic examples shown).
- **Edit Mode** (two variant columns shown side by side, same layout different
  colors/values — likely showing "before/after" of a swatch swap):
  - Gradient preview shrinks to top portion of the card (matches our stub
    transition concept).
  - **Geometry-switch tabs** directly below the preview: `Linear | Angular |
    Radial | Square`, pill-button style, active tab shown filled/dark. This lets
    the user change the gradient's geometry type while staying in Edit Mode on
    the same color stops — not present in the PRD's original Edit Mode
    description, worth confirming intent (does switching type re-render the same
    stops in the new geometry, e.g. conic vs linear?).
  - **Color block stack**: instead of uniform solid rectangles, the blocks appear
    to visually echo the gradient itself — each block shows a vertical gradient
    transition into the next block's color (soft blend at boundaries) rather than
    a hard-edged flat swatch. Worth clarifying against PRD 3.2, which describes
    blocks as flat "solid color blocks."
  - **Swatch carousel**: horizontal row of small circular/rounded swatches at the
    very bottom, scrollable, consistent with PRD 3.2.
  - Radial example: shows the radial gradient's circular falloff reflected in the
    block stack shape/blend, not just flat divisions.
  - Angular/conic example: shows a literal pie/wheel-shaped Edit Mode preview
    instead of a card shape for the "Square" (Turrell) view — the wheel graphic
    with quadrant coloring suggests the color-block representation may adapt its
    shape to match the active geometry type, not always be a rectangle stack.

## Open questions for Edit Mode brainstorming session

1. Should switching the geometry tab in Edit Mode re-map existing stops onto the
   new geometry, or reset to defaults for that type?
2. Do color blocks show soft gradient blends between them (as pictured) or flat
   dividers per PRD 3.2's literal text? This mockup suggests blended, PRD text
   suggests flat — needs a product decision.
3. Does the block-stack visualization change shape based on gradient type (e.g.
   wheel/pie shape for angular/Turrell, rectangle stack for linear/radial)?
