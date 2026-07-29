/**
 * Class lists for chrome that floats on a gradient.
 *
 * These ARE LDS media buttons — `.emph-media` re-tones a button for artwork
 * (currentColor ink, a scrim-based fill, a currentColor hairline) and
 * `--on-dark` pins that pair to white-on-black, which is the combination that
 * survives any gradient underneath. `.ghost-chip` is the small delta the
 * system leaves to the app; see the block comment on it in index.css.
 *
 * In one place rather than spelled out at each call site: there are eight of
 * them across five files, and the previous hand-written recipe drifted between
 * them (different alphas, different heights) until the whole set stopped
 * reading as one kind of thing. A constant cannot drift.
 */

/** Labelled chip — Save, Edit, Export. Padded for text. */
export const MEDIA_CHIP = 'lds-btn emph-media emph-media--on-dark ghost-chip ghost-pill'

/** Compact labelled chip — the gallery tile's hover actions, which sit inside a
 * thumbnail rather than on a full-bleed gradient. `--sm` supplies the tighter
 * type and padding; the height still has to be pulled down at the call site,
 * because `--target-min` is set by `.emph-media`, not by the size modifier. */
export const MEDIA_CHIP_SM = 'lds-btn lds-btn--sm emph-media emph-media--on-dark ghost-chip'

/** Icon-only chip — back, close, share, play. Square at --target-min. */
export const MEDIA_ICON = 'lds-btn lds-btn--icon emph-media emph-media--on-dark ghost-chip'

/** Toggled-on state for either. */
export const MEDIA_ON = 'ghost-chip-active'
