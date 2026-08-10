# Proposal: Mobile Nav Bar component for lew-design-system (LDS)

## Problem

Palette's mobile app hand-rolls its own tab bar (`src/components/TabBar.tsx` +
`TabBar.module.css`) instead of using a shared LDS component, because LDS
currently has no nav bar — it only ships CSS tokens (`hues.css`, `lds.css`)
and a contrast-color JS util (`ink`).

The bespoke implementation has a real usability bug: the bar is
`position: fixed` (so it doesn't scroll away positionally), but it also
"ducks" on scroll — while `panelOpen || editing` is true and the user is
mid-scroll, `useScrolling()` flips the bar to `opacity: 0` **and**
`pointer-events: none` (`TabBar.tsx:98`, `.hidden` in
`TabBar.module.css`). A tap that lands during that window silently does
nothing, so changing the selected tab can feel broken/unresponsive.

Building a shared LDS nav bar would let Palette (and other LDS consumers)
get correct, tested fixed-nav behavior for free, and prevents this class of
bug from being reinvented per-app.

## Goals

- One reusable, themeable mobile nav/tab bar component in LDS.
- Genuinely fixed positioning — never scrolls with page content.
- Controlled selection: host app owns and passes the active tab; component
  never hides that state internally.
- No hidden-but-rendered dead zones: if the bar is visible, it must be
  interactive.

## Non-goals

- Desktop/top nav patterns (out of scope; mobile bottom bar only).
- Routing integration — the component emits a selection change; navigation
  is the host app's responsibility (mirrors Palette's `onChange` prop).

## Requirements

### Positioning
- `position: fixed` (or `sticky` with a documented fallback), anchored to
  viewport bottom.
- Built-in `env(safe-area-inset-bottom)` handling so it clears the home
  indicator / gesture bar on iOS/Android without host apps re-deriving it.
- Configurable `z-index` token so app chrome (sheets, modals) can layer
  above it deliberately.

### Selection state
- Controlled prop, e.g. `selected: string`, `onSelect: (id: string) => void`
  — no internal-only selection state.
- Sets `aria-current="page"` on the active tab automatically.
- Selecting a tab must never change the bar's layout/width (avoid reflow
  on tap) — Palette currently solves this per-tab with a `data-text`
  width-reservation trick; LDS should solve it once, centrally.

### Visibility behavior (the core bug to prevent)
- **Hard requirement: whenever the component is not `display: none`, it
  must remain interactive.** Opacity and `pointer-events` must never be
  decoupled such that a visually-transitioning (or invisible-but-mounted)
  bar can silently swallow taps.
- If auto-hide/duck-on-scroll is supported at all, it must be an **opt-in
  variant** with:
  - No fade-only state — either fully shown+interactive or fully
    hidden+non-interactive, with the transition treated as instantaneous
    for hit-testing (i.e. toggle `pointer-events` in lockstep with the
    visibility class, not decoupled by a separate `revealed`/timer flag).
  - A documented minimum debounce so a bar doesn't flicker hidden between
    quick scroll gestures.
- Default variant (no auto-hide) should be the recommended/default export;
  auto-hide is the exception, not the baseline.

### Content model
- Slot-based tab content: label, optional leading icon, optional badge
  (e.g. a count), and optional custom content region — Palette's Gallery
  tab needs to render a small fanned thumbnail stack of recent saves,
  which won't fit a label+icon-only API.
- Tab count: support 2–5 tabs without bespoke CSS per host app.

### Theming
- Colors/spacing driven entirely by existing LDS tokens (`hues.css`,
  `lds.css`) — no component-local hardcoded colors.
- Respects light/dark or per-app hue theming the way Palette's
  `themes/palette.css` layers on top of LDS today.

### API sketch (illustrative, not final)
```tsx
<LdsNavBar
  selected={mode}
  onSelect={(id) => setMode(id)}
  autoHide={false}
  tabs={[
    { id: 'gallery', label: 'Gallery', badge: savedCount, content: <ThumbStack items={recent} /> },
    { id: 'create', label: 'Create' },
  ]}
/>
```

## Acceptance criteria

1. Component renders fixed to viewport bottom across iOS Safari, Chrome
   Android, and desktop-narrow, honoring safe-area insets.
2. Tapping any visible tab always fires `onSelect` — including
   immediately after a scroll gesture ends — with no dead-tap window.
3. `aria-current` and keyboard focus/activation (Enter/Space) work
   correctly for the active tab.
4. If `autoHide` is enabled, `pointer-events` and visibility toggle
   together — never a state where the bar is `opacity: 0`/faded but
   still `pointer-events: auto`, or vice versa mid-transition.
5. Selecting a tab does not resize/reflow the bar.
6. Component ships with no local color values — passes a lint/check that
   all colors resolve to LDS tokens.
7. Storybook (or LDS's existing doc pattern) includes: default 2-tab,
   3+ tab, with-badge, with-custom-content, and autoHide-enabled examples.

## Open questions

- Should `autoHide` exist at all in LDS, or should scroll-duck chrome
  behavior stay app-specific (i.e. host apps wrap the LDS bar rather than
  LDS owning the duck logic)? Given the bug this proposal is motivated by,
  leaning towards: **not in v1** — ship the always-visible fixed bar first,
  revisit auto-hide as a separate proposal once the interaction contract
  above is validated.
- Does LDS want a generic `NavBar` (top or bottom, configurable) or a
  purpose-built `MobileTabBar`? This proposal assumes the latter, scoped
  to bottom mobile nav, to keep the API small.
- Icon system: does LDS already have an icon set to standardize on for
  the optional leading-icon slot, or does that need its own proposal?
- Max tab count / overflow behavior (e.g. 6+ tabs) — not addressed here;
  Palette only needs 2 today.

## Migration path for Palette

Once available, `TabBar.tsx` would become a thin wrapper passing Palette's
`mode`/`onChange`/`recentGradients` into `LdsNavBar`'s `selected`/
`onSelect`/custom `content` slot, and `useScrolling`'s duck logic would be
dropped entirely (or reimplemented against LDS's `autoHide` prop, if/when
that ships) — directly fixing the tap-during-scroll bug described above.
