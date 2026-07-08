# Mobile Polish Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix twelve mobile UX defects/features reported on 2026-07-08: smooth ticker, haptics, idle-fade chrome, Turrell blur bleed, repeat-seam hue artifact, shape persistence across edit round-trips, sort FAB exiting edit mode, drawer scrim removal, iPhone notch coverage, drag-to-dismiss bottom sheet with a real move/resize transition, tap-to-save conflict, and a toggleable mono noise overlay.

**Architecture:** Each fix is isolated. New modules: `src/lib/haptics.ts`, `src/hooks/useIdleFade.ts`, `src/components/NoiseOverlay.tsx`. The tap-conflict and sort-FAB bugs share one root cause (container-level `pointerup` handlers firing for taps on child buttons) and one fix (guard on `e.target.closest('button')`). The dissolve-instead-of-morph is fixed in `index.css` view-transition rules; the interactive sheet dismissal is a drag handler in `EditMode.tsx` that shrinks the sheet's real height so the flexed preview grows live.

**Tech Stack:** React 19, TypeScript, Vite, Zustand 5 (persist), Vitest + @testing-library/react + jsdom. Test: `npm test`. Build: `npm run build`.

---

## Task 1: Smooth ScrollTicker (choppy on mobile)

Root cause: every index change re-renders 21 ticks each with its own 220ms transform transition; rapid scrubbing restarts all transitions and `flushSync` forces sync layout. Fix: render ticks at fixed offsets inside one translated strip; only the strip animates.

**Files:** Modify `src/components/ScrollTicker.tsx`, `src/components/ScrollTicker.module.css`. Test: `src/components/ScrollTicker.test.tsx` (existing tests must keep passing; testids preserved).

- [ ] Rewrite render: a `.strip` div with `style={{ transform: translateY(-index * TICK_SPACING_PX) }}`, ticks absolutely positioned at `top: t * TICK_SPACING_PX`. Move the transition + `will-change: transform` to `.strip`; remove per-tick transitions. Replace `flushSync(() => setVisible(false))` with plain `setVisible(false)`.
- [ ] `npm test -- ScrollTicker` → PASS; commit `fix: animate scroll ticker as a single strip to stop per-tick jank`.

## Task 2: Haptics on tick steps (iOS)

`navigator.vibrate` is a no-op on iOS Safari. Add `src/lib/haptics.ts` exporting `tickHaptic()`: uses `navigator.vibrate(10)` when available; otherwise toggles a hidden `<input type="checkbox" switch>` (Safari 18+ fires a haptic for switch toggles inside a user gesture). The input is lazily created once and appended off-screen.

**Files:** Create `src/lib/haptics.ts` + `src/lib/haptics.test.ts`. Modify `src/components/Feed.tsx` (replace `vibrateStep`).

```ts
let switchInput: HTMLInputElement | null = null
function iosSwitchHaptic() {
  if (!switchInput) {
    switchInput = document.createElement('input')
    switchInput.type = 'checkbox'
    switchInput.setAttribute('switch', '')
    switchInput.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-100px'
    document.body.appendChild(switchInput)
  }
  switchInput.click()
}
export function tickHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10)
  else if (typeof document !== 'undefined') iosSwitchHaptic()
}
```

- [ ] Test: vibrate path called with 10 when stubbed; switch path appends one input and clicks it when vibrate absent.
- [ ] Replace `vibrateStep()` in Feed's `goTo` with `tickHaptic()`. Commit.

## Task 3: Idle fade of drawer + heart on explore

**Files:** Create `src/hooks/useIdleFade.ts` + test. Modify `Feed.tsx`, `App.tsx`, `Drawer.tsx` (+ module css), `GradientPage.tsx`, `LikeButton.module.css`.

`useIdleFade(timeoutMs = 4000)` returns `active: boolean`; sets `active=false` after timeout, `true` on any `pointerdown|wheel|touchmove|keydown` on window (reset timer). Feed passes `chromeVisible` down: `LikeButton` and `Drawer` get `opacity: 0; pointer-events: none; transition: opacity 400ms ease` when hidden (via a `hidden` prop/class). Drawer visibility is controlled from App, so lift the hook to `App.tsx` (explore branch only) and pass `chromeVisible` to both `Feed` (→ GradientPage → LikeButton) and `Drawer`.

- [ ] Test hook with fake timers: starts active, goes inactive after 4s, reactivates on pointerdown.
- [ ] Wire props + CSS; keep EditMode unaffected. Commit.

## Task 4: Turrell blur edge bleed

Root cause: the outermost layer is exactly 100% and `blur(24px)` samples transparency past its edge, showing a soft halo of the page background at container edges. Fix: oversize the outermost layer beyond the container by `4×blur` so the blurred edge is clipped by `overflow: hidden`.

**Files:** Modify `src/components/TurrellSquare.tsx`. Test: `TurrellSquare.test.tsx`.

- [ ] For `i === 0`, set `width/height: calc(100% + 96px)` (or `100% + blurPx*4` when `blurPx` provided). Test asserts first layer's width style includes `calc`.
- [ ] Commit `fix: oversize outer Turrell layer so blur doesn't bleed past edges`.

## Task 5: Repeat gradient seam hue artifact

Root cause: `buildRepeatGradient` inserts a synthetic OKLCH midpoint (`blendOklchHex`) between the last and first colors; OKLCH hue interpolation can traverse hues not present in the palette. Fix: drop the synthetic seam stop — `sequence = [...hexes, ...hexes]` lets CSS interpolate last→first directly.

**Files:** Modify `src/lib/gradient.ts`. Test: `src/lib/gradient.test.ts`.

- [ ] Update/replace the repeat test: output contains each hex exactly twice and no hex not in the input. Remove the now-unused `blendOklchHex` import if unused elsewhere in the file.
- [ ] Commit.

## Task 6: Preserve edited shape returning to explore

Root cause: EditMode's `commit` keeps the gradient `id`, and Feed's store-sync effect only overwrites `history[index]` when `atIndex.id !== current.id`, so type/stop edits are dropped on remount. Fix: compare by reference (`atIndex !== current`) and, in the mount effect's restore branch, prefer `current` when it differs from `history[index]` (write it into the slot) and re-lock `feedSession.lockedType = current.type`.

**Files:** Modify `src/components/Feed.tsx`. Test: `Feed.test.tsx` — set store gradient, enter/exit edit having changed `type`, remount Feed, assert displayed gradient has the edited type.

- [ ] Commit `fix: preserve edited gradient shape across an edit-mode round trip`.

## Task 7: Container pointerup fires for child-button taps (sort FAB exits edit; tap-to-save enters edit)

Root cause: EditMode's preview `onPointerUp={onExit}` and GradientPage's tap→`onEdit` rely on child `stopPropagation`, which is not reliable across iOS pointer/touch synthesis. Fix deterministically: in both container handlers, return early when `(e.target as HTMLElement).closest('button')` is non-null.

**Files:** Modify `src/components/EditMode.tsx`, `src/components/GradientPage.tsx`. Tests: EditMode — clicking/pointerup on sort FAB does NOT call `onExit` and DOES change sort; GradientPage — pointerup on the like button does not call `onEdit`.

- [ ] Also apply the same movement-threshold tap detection to the EditMode preview (pointerdown records position; pointerup exits only for real taps), so scroll gestures over the preview don't exit.
- [ ] Commit.

## Task 8: Remove drawer scrim

**Files:** Modify `src/components/Drawer.module.css` — delete `background: rgba(0,0,0,0.6)` from `.drawer` (keep layout). CSS-only; run full suite. Commit.

## Task 9: iPhone notch / safe-area coverage

**Files:** Modify `index.html`, `src/index.css`, `src/components/Feed.module.css`, `src/components/GradientPage.module.css`, `src/components/EditMode.module.css`, `src/components/LikeButton.module.css`.

- [ ] `index.html`: viewport → `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- [ ] Replace `height: 100vh` with `height: 100dvh` in Feed `.container`, GradientPage `.page`, EditMode `.container`. Add `html, body { height: 100%; overscroll-behavior: none; }`.
- [ ] Safe-area padding for controls only (never the gradient): back button `top: calc(12px + env(safe-area-inset-top))`; like button `bottom: calc(16px + env(safe-area-inset-bottom))`; drawer `padding-bottom: calc(8px + env(safe-area-inset-bottom))`.
- [ ] CSS-only: full suite passes; commit.

## Task 10: Real move/resize transition + drag-to-dismiss bottom sheet

Two parts:

**(a) Kill the dissolve.** The `palette-card` group already morphs size, but the default old/new image cross-fade reads as a dissolve. In `src/index.css` replace the old/new rules with:

```css
::view-transition-old(palette-card) { display: none; }
::view-transition-new(palette-card) { animation: none; width: 100%; height: 100%; }
```

**(b) Scroll/drag the sheet down to exit.** In `EditMode.tsx`, add touch handlers on the sheet: on `touchstart` record startY and the sheet's measured `offsetHeight` (ref); on `touchmove` compute `dragY = clamp(touchY - startY, 0, base)` and set inline `height: base - dragY` on the sheet (flexed preview grows live — a true move/resize) via state; on `touchend`, if `dragY > base * 0.3` call `onExit()` (already wrapped in `withViewTransition` by App), else reset height to auto. Attach non-passive `touchmove` with `preventDefault()` so the page itself never scrolls.

**Files:** Modify `src/components/EditMode.tsx`, `src/components/EditMode.module.css`, `src/index.css`. Test: jsdom — dispatch touch sequence on `edit-sheet` exceeding threshold, assert `onExit` called; below threshold, not called.

- [ ] Commit.

## Task 11: Mono noise overlay toggle

**Files:** Create `src/components/NoiseOverlay.tsx` + `NoiseOverlay.module.css` + test. Modify `src/store/useAppStore.ts` (add `noiseEnabled: boolean`, `toggleNoise()`, persist it), `GradientPage.tsx`, `EditMode.tsx` (render overlay in preview + a grain toggle button next to the like button).

NoiseOverlay: absolutely-positioned, `pointer-events: none`, full-bleed div whose background is an inline SVG data-URI: `feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"` piped through `feColorMatrix` collapsing RGB to luminance-driven alpha over black (mono, no color noise), `background-size: 128px`, `opacity: 0.35`, `mix-blend-mode: overlay`. Renders `null` when `visible` is false. Toggle button `aria-label="Toggle grain"` stops pointer propagation like LikeButton and is guarded by Task 7's `closest('button')` check.

- [ ] Store test: `noiseEnabled` defaults false, `toggleNoise` flips, persisted via partialize.
- [ ] Component test: overlay present when enabled in both GradientPage and EditMode preview; button toggles store.
- [ ] Commit.

## Task 12: Verification

- [ ] `npm test` full suite; `npm run build`.
- [ ] Commit any stragglers.
