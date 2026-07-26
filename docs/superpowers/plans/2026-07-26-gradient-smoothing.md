# Gradient Smoothing ("Smooth" toggle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in per-gradient "Smooth" toggle that dissolves the harsh seams between colors by inserting Oklab-blended, ease-in-out–distributed interior stops.

**Architecture:** A pure `smoothStops(stops)` transform densifies any positioned stop list — original stops stay put, interior samples follow a smoothstep curve blended in Oklab (rectangular, no phantom hues). It is threaded as a `smooth` filter through `buildGradientCss` (all continuous geometries; skipped for square; `hard` wins if both set) and mirrored in the SVG and canvas export paths. State lives on `Gradient.smoothEnabled`, persisted in the share codec (not Supabase). UI is a chip in `GeometryTabs`, mutually exclusive with Hard.

**Tech Stack:** TypeScript, React, Vite, Vitest. Color math in `src/lib/oklch.ts`.

**Reference spec:** `docs/superpowers/specs/2026-07-26-gradient-smoothing-design.md`

**Note on prior art:** A `smooth` filter existed before and was removed in `9cb40d2` because its OKLCH blending produced phantom hues. This plan uses **Oklab** specifically to fix that. Do not reintroduce `blendOklchHex` for smoothing.

---

### Task 1: `blendOklabHex` color blend

**Files:**
- Modify: `src/lib/oklch.ts`
- Test: `src/lib/oklch.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/oklch.test.ts`:

```ts
import { blendOklabHex, hexToSrgb } from './oklch'

describe('blendOklabHex', () => {
  it('returns the endpoints exactly at t=0 and t=1', () => {
    expect(blendOklabHex('#ff0000', '#0000ff', 0)).toBe('#ff0000')
    expect(blendOklabHex('#ff0000', '#0000ff', 1)).toBe('#0000ff')
  })

  it('blends black and white to a neutral gray at the midpoint', () => {
    const mid = blendOklabHex('#000000', '#ffffff', 0.5)
    const { r, g, b } = hexToSrgb(mid)
    expect(r).toBe(g)
    expect(g).toBe(b)
    expect(r).toBeGreaterThan(80)
    expect(r).toBeLessThan(120)
  })

  it('does not introduce a phantom hue (green->magenta midpoint is near-neutral, not green/cyan)', () => {
    const mid = blendOklabHex('#00ff00', '#ff00ff', 0.5)
    const { r, g, b } = hexToSrgb(mid)
    // A polar OKLCH arc would keep green dominant; the Oklab straight line
    // desaturates toward neutral so green never dominates red & blue.
    expect(g).toBeLessThan(200)
    expect(Math.abs(r - b)).toBeLessThan(40)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/oklch.test.ts`
Expected: FAIL — `blendOklabHex is not exported` / not a function.

- [ ] **Step 3: Implement `blendOklabHex`**

In `src/lib/oklch.ts`, add these helpers just above the existing `blendOklchHex` (they reuse the existing `hexToSrgb`, `gammaToLinear`, `linearSrgbToOklab`, `oklabToLinearSrgb`, `linearToGamma`, `clamp255`, `lerp`):

```ts
function hexToOklab(hex: string): { L: number; a: number; b: number } {
  const srgb = hexToSrgb(hex)
  const linear = {
    r: gammaToLinear(srgb.r / 255),
    g: gammaToLinear(srgb.g / 255),
    b: gammaToLinear(srgb.b / 255),
  }
  return linearSrgbToOklab(linear)
}

function oklabToHex(oklab: { L: number; a: number; b: number }): string {
  const linear = oklabToLinearSrgb(oklab)
  const toHex = (v: number) => Math.round(clamp255(linearToGamma(v) * 255)).toString(16).padStart(2, '0')
  return `#${toHex(linear.r)}${toHex(linear.g)}${toHex(linear.b)}`
}

/** Blends two hex colors in Oklab (rectangular L/a/b). Unlike blendOklchHex,
 * this travels a straight line and never loops around the hue wheel, so it
 * introduces no in-between hues that weren't in the endpoints. */
export function blendOklabHex(hexA: string, hexB: string, t = 0.5): string {
  const a = hexToOklab(hexA)
  const b = hexToOklab(hexB)
  return oklabToHex({
    L: lerp(a.L, b.L, t),
    a: lerp(a.a, b.a, t),
    b: lerp(a.b, b.b, t),
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/oklch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/oklch.ts src/lib/oklch.test.ts
git commit -m "feat(gradient): add blendOklabHex for phantom-hue-free blending"
```

---

### Task 2: `smoothStops` transform

**Files:**
- Modify: `src/lib/gradient.ts` (import line 3; add function near `hardenStops`)
- Test: `src/lib/gradient.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/gradient.test.ts` (import `smoothStops` and `SMOOTH_SAMPLES_PER_SEGMENT` from `./gradient`):

```ts
import { smoothStops, SMOOTH_SAMPLES_PER_SEGMENT } from './gradient'

describe('smoothStops', () => {
  const bw = [
    { hex: '#000000', position: 0 },
    { hex: '#ffffff', position: 100 },
  ]

  it('keeps the original endpoints exactly', () => {
    const out = smoothStops(bw)
    expect(out[0]).toEqual({ hex: '#000000', position: 0 })
    expect(out[out.length - 1]).toEqual({ hex: '#ffffff', position: 100 })
  })

  it('inserts SMOOTH_SAMPLES_PER_SEGMENT interior stops per segment', () => {
    // 1 leading endpoint + (samples interior + 1 trailing) per segment
    expect(smoothStops(bw)).toHaveLength(1 + (SMOOTH_SAMPLES_PER_SEGMENT + 1))
  })

  it('produces monotonically non-decreasing positions', () => {
    const out = smoothStops([
      { hex: '#ff0000', position: 0 },
      { hex: '#00ff00', position: 50 },
      { hex: '#0000ff', position: 100 },
    ])
    for (let i = 1; i < out.length; i++) {
      expect(out[i].position).toBeGreaterThanOrEqual(out[i - 1].position)
    }
  })

  it('returns lists shorter than 2 unchanged', () => {
    const one = [{ hex: '#ffffff', position: 0 }]
    expect(smoothStops(one)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/gradient.test.ts -t smoothStops`
Expected: FAIL — `smoothStops is not exported`.

- [ ] **Step 3: Implement `smoothStops`**

In `src/lib/gradient.ts`, change the import on line 3 from:

```ts
import { blendOklchHex } from './oklch'
```
to:
```ts
import { blendOklchHex, blendOklabHex } from './oklch'
```

Then add, immediately after the `hardenStops` function (which ends near line 209):

```ts
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Interior samples inserted between each adjacent stop pair when smoothing. */
export const SMOOTH_SAMPLES_PER_SEGMENT = 16

/** Densifies a stop list for seamless transitions. The user's stops stay
 * exactly where they are; between each adjacent pair we insert
 * SMOOTH_SAMPLES_PER_SEGMENT interior stops whose COLOR follows an ease-in-out
 * (smoothstep) curve, blended in Oklab. The eased distribution drives the rate
 * of color change to zero at every original stop — dissolving the Mach-band
 * seam — while Oklab blending avoids the phantom in-between hues that polar
 * OKLCH interpolation produces. */
export function smoothStops(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 2) return stops
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const result: GradientStop[] = [{ ...sorted[0] }]
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    for (let k = 1; k <= SMOOTH_SAMPLES_PER_SEGMENT; k++) {
      const raw = k / (SMOOTH_SAMPLES_PER_SEGMENT + 1)
      result.push({
        hex: blendOklabHex(a.hex, b.hex, easeInOut(raw)),
        position: Math.round((a.position + (b.position - a.position) * raw) * 10) / 10,
      })
    }
    result.push({ ...b })
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/gradient.test.ts -t smoothStops`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gradient.ts src/lib/gradient.test.ts
git commit -m "feat(gradient): add smoothStops ease-in-out densifier"
```

---

### Task 3: Wire `smooth` filter into `buildGradientCss`

**Files:**
- Modify: `src/lib/gradient.ts` (`GradientFilters`, the four `build*Gradient` helpers, `buildGradientCss`)
- Test: `src/lib/gradient.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/gradient.test.ts`:

```ts
import { buildGradientCss } from './gradient'

describe('buildGradientCss smooth filter', () => {
  const bw = [
    { hex: '#000000', position: 0 },
    { hex: '#ffffff', position: 100 },
  ]
  const countHashes = (s: string) => (s.match(/#/g) || []).length

  it('densifies a linear gradient when smooth is on', () => {
    const plain = buildGradientCss('linear', bw)
    const smooth = buildGradientCss('linear', bw, false, { smooth: true })
    expect(smooth.startsWith('linear-gradient(')).toBe(true)
    expect(countHashes(smooth)).toBeGreaterThan(countHashes(plain))
  })

  it('lets hard win when both hard and smooth are set', () => {
    const both = buildGradientCss('linear', bw, false, { smooth: true, hard: true })
    const hardOnly = buildGradientCss('linear', bw, false, { hard: true })
    expect(both).toBe(hardOnly)
  })

  it('ignores smooth for square (solid blocks)', () => {
    expect(buildGradientCss('square', bw, false, { smooth: true })).toBe(
      buildGradientCss('square', bw)
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/gradient.test.ts -t "smooth filter"`
Expected: FAIL — smooth has no effect (hash counts equal), `smooth` not in `GradientFilters`.

- [ ] **Step 3: Add `smooth` to `GradientFilters` and thread it through the builders**

In `src/lib/gradient.ts`:

1. Add to the `GradientFilters` interface (after `hard`):
```ts
  /** Densifies the blend with Oklab-eased interior stops so transitions are
   * seamless. Mutually exclusive with `hard`; ignored for `square`. */
  smooth?: boolean
```

2. Update `buildAngularGradient` signature and the soft (non-hard) return:
```ts
function buildAngularGradient(stops: GradientStop[], hard = false, angle = 0, smooth = false): string {
```
Leave the `if (hard) { ... }` block unchanged. Change the final two lines from:
```ts
  const withSeam = [...spread, { hex: stops[0].hex, position: 100 }]
  return `conic-gradient(from ${angle}deg, ${stopsToCss(withSeam)})`
```
to:
```ts
  const withSeam = [...spread, { hex: stops[0].hex, position: 100 }]
  const finalStops = smooth ? smoothStops(withSeam) : withSeam
  return `conic-gradient(from ${angle}deg, ${stopsToCss(finalStops)})`
```

3. Update `buildFanGradient` signature and return:
```ts
function buildFanGradient(stops: GradientStop[], anchor: FanAnchor = 'bottom', angle?: number, smooth = false): string {
```
Change:
```ts
  const withTail = [...compressed, { hex: stops[stops.length - 1].hex, position: 100 }]
  return `conic-gradient(from ${from}deg at ${at}, ${stopsToCss(withTail)})`
```
to:
```ts
  const withTail = [...compressed, { hex: stops[stops.length - 1].hex, position: 100 }]
  const finalStops = smooth ? smoothStops(withTail) : withTail
  return `conic-gradient(from ${from}deg at ${at}, ${stopsToCss(finalStops)})`
```

4. Update `buildMirrorGradient` signature and return:
```ts
function buildMirrorGradient(stops: GradientStop[], angle = 0, smooth = false): string {
```
Change:
```ts
  const mirrored = [...forward, ...reverse]
  return `linear-gradient(${180 + angle}deg, ${stopsToCss(mirrored)})`
```
to:
```ts
  const mirrored = [...forward, ...reverse]
  const finalStops = smooth ? smoothStops(mirrored) : mirrored
  return `linear-gradient(${180 + angle}deg, ${stopsToCss(finalStops)})`
```

5. Update `buildRepeatGradient` signature and body:
```ts
function buildRepeatGradient(stops: GradientStop[], angle = 0, smooth = false): string {
  const seq = repeatedStops(stops)
  const finalStops = smooth ? smoothStops(seq) : seq
  return `linear-gradient(${180 + angle}deg, ${stopsToCss(finalStops)})`
}
```

- [ ] **Step 4: Update `buildGradientCss` dispatch**

Replace the body of `buildGradientCss` from the `const angle = filters.angle ?? 0` line through the end of the `switch` with:

```ts
  // Smoothing densifies the final blend with Oklab-eased interior stops. It is
  // meaningless for solid squares and is mutually exclusive with hard bands
  // (hard wins), matching how the UI keeps the two toggles exclusive.
  const smooth = !!filters.smooth && !filters.hard && type !== 'square'
  const angle = filters.angle ?? 0
  switch (type) {
    case 'linear':
      return `linear-gradient(${180 + angle}deg, ${stopsToCss(smooth ? smoothStops(orderedStops) : orderedStops)})`
    case 'radial': {
      const { css } = getRadialConfig(filters.angle)
      return `radial-gradient(circle at ${css}, ${stopsToCss(smooth ? smoothStops(orderedStops) : orderedStops)})`
    }
    case 'angular':
      return buildAngularGradient(orderedStops, filters.hard, angle, smooth)
    case 'square':
      return buildSquareGradient(orderedStops)
    case 'mirror':
      return buildMirrorGradient(orderedStops, angle, smooth)
    case 'repeat':
      return buildRepeatGradient(orderedStops, angle, smooth)
    case 'fan':
      return buildFanGradient(orderedStops, filters?.fanAnchor, filters?.angle, smooth)
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/gradient.test.ts`
Expected: PASS (new smooth tests plus all pre-existing gradient tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/gradient.ts src/lib/gradient.test.ts
git commit -m "feat(gradient): thread smooth filter through buildGradientCss"
```

---

### Task 4: `smoothEnabled` state + share codec

**Files:**
- Modify: `src/store/types.ts:18`
- Modify: `src/lib/gradientCodec.ts` (interface, `toSharePayloadGradient`, `importGradient`, `isSharePayloadGradient`, stale comment)
- Test: `src/lib/gradientCodec.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/gradientCodec.test.ts` (it already imports `importGradient`; add `toSharePayloadGradient` and `isSharePayloadGradient` to the import list from `./gradientCodec`):

```ts
describe('smoothEnabled persistence', () => {
  const g = {
    id: 'x',
    type: 'linear' as const,
    stops: [
      { hex: '#000000', position: 0 },
      { hex: '#ffffff', position: 100 },
    ],
    smoothEnabled: true,
    name: 'n',
  }

  it('round-trips smoothEnabled through the share payload', () => {
    const round = importGradient(toSharePayloadGradient(g))
    expect(round.smoothEnabled).toBe(true)
  })

  it('validates smoothEnabled as an optional boolean', () => {
    const base = {
      type: 'linear',
      stops: [
        { hex: '#000000', position: 0 },
        { hex: '#ffffff', position: 100 },
      ],
      name: 'n',
    }
    expect(isSharePayloadGradient({ ...base, smoothEnabled: true })).toBe(true)
    expect(isSharePayloadGradient({ ...base, smoothEnabled: 'yes' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/gradientCodec.test.ts -t smoothEnabled`
Expected: FAIL — `toSharePayloadGradient`/`isSharePayloadGradient` may be unexported and `smoothEnabled` is dropped.

- [ ] **Step 3: Add `smoothEnabled` to the Gradient type**

In `src/store/types.ts`, add after line 18 (`hardStops?: boolean`):
```ts
  /** Densify the blend with Oklab-eased interior stops for seamless
   * transitions. Mutually exclusive with hardStops. */
  smoothEnabled?: boolean
```

- [ ] **Step 4: Thread `smoothEnabled` through the codec**

In `src/lib/gradientCodec.ts`:

1. Add to `SharePayloadGradient` (after `hardStops?: boolean`):
```ts
  smoothEnabled?: boolean
```

2. Update the stale comment above `importGradient` — change the parenthetical
`(e.g. the removed smoothEnabled/flutedEnabled)` to `(e.g. the removed flutedEnabled)`.

3. In `toSharePayloadGradient`, after the `hardStops` line:
```ts
  if (gradient.smoothEnabled !== undefined) out.smoothEnabled = gradient.smoothEnabled
```

4. In `importGradient`, after the `hardStops` line:
```ts
  if (g.smoothEnabled !== undefined) out.smoothEnabled = g.smoothEnabled
```

5. In `isSharePayloadGradient`, after the `hardStops` predicate line:
```ts
    (v.smoothEnabled === undefined || typeof v.smoothEnabled === 'boolean') &&
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/gradientCodec.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/types.ts src/lib/gradientCodec.ts src/lib/gradientCodec.test.ts
git commit -m "feat(gradient): persist smoothEnabled in share codec"
```

---

### Task 5: SVG export parity

**Files:**
- Modify: `src/lib/gradientSvg.ts` (import + `effectiveStops`)
- Test: `src/lib/gradientSvg.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/gradientSvg.test.ts`:

```ts
it('emits extra <stop> elements when smoothEnabled', () => {
  const base = {
    id: 'x',
    type: 'linear' as const,
    stops: [
      { hex: '#000000', position: 0 },
      { hex: '#ffffff', position: 100 },
    ],
  }
  const plain = gradientToSvg(base)
  const smoothed = gradientToSvg({ ...base, smoothEnabled: true })
  const count = (s: string) => (s.match(/<stop/g) || []).length
  expect(count(smoothed)).toBeGreaterThan(count(plain))
})
```

(If the test file doesn't already import `gradientToSvg`, add `import { gradientToSvg } from './gradientSvg'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/gradientSvg.test.ts -t smoothEnabled`
Expected: FAIL — stop counts equal.

- [ ] **Step 3: Apply smoothing in `effectiveStops`**

In `src/lib/gradientSvg.ts`:

1. Add `smoothStops` to the import from `./gradient`:
```ts
import { applyReversed, positionedStops, repeatedStops, hardenStops, smoothStops } from './gradient'
```

2. Inside `effectiveStops`, right after `const hexes = reversed.map((s) => s.hex)`, add a local helper:
```ts
  const smooth = (s: GradientStop[]): GradientStop[] =>
    gradient.smoothEnabled && !gradient.hardStops ? smoothStops(s) : s
```

3. Wrap the continuous-blend returns with `smooth(...)`:
- `case 'mirror':` return `smooth(positionedStops(mirrored))`
- `case 'repeat':` return `smooth(positionedStops([...hexes, ...hexes]))`
- leave `case 'square':` returning `reversed` unchanged
- in `default:`, change `return stops` to `return smooth(stops)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/gradientSvg.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gradientSvg.ts src/lib/gradientSvg.test.ts
git commit -m "feat(gradient): smooth SVG export to match on-screen render"
```

---

### Task 6: Raster/PNG export parity (linear & radial)

**Files:**
- Modify: `src/lib/canvasExport.ts` (import line 2-10; destructure ~43-50; filter block ~60-64)
- Test: `src/lib/canvasExport.test.ts`

**Scope note:** This smooths the shared `stops` list that the linear and radial
`addColorStop` paths consume — the primary export cases. Angular/fan/mirror/repeat
rebuild their own sequences downstream and are left at their current (unsmoothed)
raster behavior; smoothing those raster paths is out of scope for this plan.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/canvasExport.test.ts`:

```ts
it('adds more color stops for a smoothed linear gradient', () => {
  const mockAddColorStop = vi.fn()
  const mockContext = {
    fillRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: mockAddColorStop }),
    fillStyle: '',
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(mockContext),
  } as unknown as HTMLCanvasElement

  renderGradientToCanvas(canvas, { ...gradient, smoothEnabled: true }, 1200, 800)

  expect(mockAddColorStop.mock.calls.length).toBeGreaterThan(2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/canvasExport.test.ts -t "smoothed linear"`
Expected: FAIL — `addColorStop` called exactly 2 times.

- [ ] **Step 3: Apply smoothing to the base stops**

In `src/lib/canvasExport.ts`:

1. Add `smoothStops` to the import block from `./gradient`:
```ts
import {
  repeatedStops,
  hardenStops,
  positionedStops,
  sampleStops,
  getFanConfig,
  FAN_ANCHOR_CONFIG,
  getRadialConfig,
  smoothStops,
} from './gradient'
```

2. Add `smoothEnabled` to the destructure (after `hardStops = false,`):
```ts
    smoothEnabled = false,
```

3. In the filter block, after `if (hardStops) stops = hardenStops(stops)`:
```ts
    if (smoothEnabled && !hardStops) stops = smoothStops(stops)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/canvasExport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/canvasExport.ts src/lib/canvasExport.test.ts
git commit -m "feat(gradient): smooth linear/radial raster export"
```

---

### Task 7: "Smooth" toggle UI

**Files:**
- Modify: `src/components/GeometryTabs.tsx` (props, `smoothDisabled`, per-tab preview filters, new chip button)
- Modify: `src/components/EditMode.tsx` (`overrides` Pick type ~535, `handleToggleSmooth` + `handleToggleHardStops`, preview filters ~750, `<GeometryTabs>` prop ~854)
- Test: `src/components/GeometryTabs.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/GeometryTabs.test.tsx` (follow the existing render/setup pattern in that file for building props; the key assertions):

```ts
it('renders a Smooth chip and calls onToggleSmooth when clicked', () => {
  const onToggleSmooth = vi.fn()
  render(
    <GeometryTabs
      gradient={{ id: 'g', type: 'linear', stops: [
        { hex: '#000000', position: 0 },
        { hex: '#ffffff', position: 100 },
      ] }}
      stops={[
        { hex: '#000000', position: 0 },
        { hex: '#ffffff', position: 100 },
      ]}
      onSelectType={vi.fn()}
      onToggleReversed={vi.fn()}
      onToggleSmooth={onToggleSmooth}
    />
  )
  const chip = screen.getByTestId('filter-smooth')
  fireEvent.click(chip)
  expect(onToggleSmooth).toHaveBeenCalledTimes(1)
})
```

(Match the exact import style — `render`, `screen`, `fireEvent` from `@testing-library/react`, `vi` from `vitest` — already used by neighboring tests in the file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/GeometryTabs.test.tsx -t "Smooth chip"`
Expected: FAIL — no element with testid `filter-smooth`.

- [ ] **Step 3: Add the chip and prop to `GeometryTabs`**

In `src/components/GeometryTabs.tsx`:

1. Add to `GeometryTabsProps` (after `onToggleHardStops?`):
```ts
  onToggleSmooth?: () => void
```

2. Add `onToggleSmooth` to the destructured params in the function signature.

3. After the `hardDisabled` declaration, add:
```ts
  // Smooth densifies a continuous blend — meaningful everywhere except the
  // solid Turrell squares.
  const smoothDisabled = gradient.type === 'square'
```

4. In the per-tab preview `buildGradientCss` filters object (the one with `repeat`/`hard`/`fanAnchor`/`angle`), add:
```ts
                  smooth: gradient.smoothEnabled,
```

5. Add a new chip button immediately before the `Hard` button (`data-testid="filter-hard"`):
```tsx
      <button
        type="button"
        data-testid="filter-smooth"
        aria-pressed={gradient.smoothEnabled}
        disabled={smoothDisabled}
        className={gradient.smoothEnabled ? styles.filterActive : styles.filter}
        onClick={onToggleSmooth}
      >
        Smooth
      </button>
```

- [ ] **Step 4: Wire the handler in `EditMode` with mutual exclusion**

In `src/components/EditMode.tsx`:

1. Extend the `overrides` Pick type (~line 535) to include `smoothEnabled`:
```ts
    overrides: Partial<Pick<Gradient, 'type' | 'reversed' | 'repeatEnabled' | 'hardStops' | 'smoothEnabled' | 'fanAnchor' | 'angle'>>
```

2. Change `handleToggleHardStops` to also clear smooth:
```ts
  function handleToggleHardStops() {
    commitPreservingPositions({ hardStops: !gradient.hardStops, smoothEnabled: false })
  }
```

3. Add `handleToggleSmooth` directly below it:
```ts
  function handleToggleSmooth() {
    commitPreservingPositions({ smoothEnabled: !gradient.smoothEnabled, hardStops: false })
  }
```

4. In the edit-mode preview `buildGradientCss` filters (~line 750-755), add:
```ts
                  smooth: gradient.smoothEnabled,
```

5. Pass the handler to `<GeometryTabs>` (~line 854, after `onToggleHardStops={handleToggleHardStops}`):
```tsx
          onToggleSmooth={handleToggleSmooth}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/GeometryTabs.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/GeometryTabs.tsx src/components/EditMode.tsx src/components/GeometryTabs.test.tsx
git commit -m "feat(gradient): add Smooth toggle chip, exclusive with Hard"
```

---

### Task 8: Reflect `smooth` in all remaining previews

**Files (each has one `buildGradientCss(...)` call whose filters object needs `smooth: <gradient>.smoothEnabled`):**
- Modify: `src/components/Gallery.tsx:43` and `:807`
- Modify: `src/components/ExportModal.tsx:70`
- Modify: `src/components/GradientPage.tsx:101`
- Modify: `src/components/CollectionsRow.tsx:35`
- Modify: `src/components/Drawer.tsx:54`
- Modify: `src/components/SavedBrowser.tsx:84`
- Modify: `src/components/TabBar.tsx:29`

(Skip `ShapePreviews.tsx:53` — it renders a fixed `'linear'` preview from bare `stops`/`reversed` with no gradient-level filters; leave it unchanged.)

- [ ] **Step 1: Add `smooth` to each call site**

For each file above, locate the `buildGradientCss(<g>.type, <g>.stops, <g>.reversed, { ... })` call and add to its filters object:
```ts
      smooth: <g>.smoothEnabled,
```
where `<g>` is the gradient variable already used in that same call (e.g. `gradient`, `g`). Match the existing `repeat`/`hard` keys already present in that object so the whole feed, gallery, drawer, export preview, and tab bar reflect the toggle.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (all suites green — deploy is gated on this).

- [ ] **Step 4: Commit**

```bash
git add src/components/Gallery.tsx src/components/ExportModal.tsx src/components/GradientPage.tsx src/components/CollectionsRow.tsx src/components/Drawer.tsx src/components/SavedBrowser.tsx src/components/TabBar.tsx
git commit -m "feat(gradient): reflect Smooth toggle across all gradient previews"
```

---

### Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck, test, and production build**

Run:
```bash
npx tsc --noEmit && npm test && npm run build
```
Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 2: Manual smoke check in the dev server**

Run the dev server, open a gradient in Edit mode, and confirm:
- A "Smooth" chip appears next to Hard/Repeat and toggles on/off.
- Turning Smooth on visibly softens the seams (test a black→yellow→black or green→black→magenta palette).
- Turning Hard on clears Smooth, and vice versa.
- Smooth is disabled on the Turrell (square) tab.
- The exported PNG (Export modal) of a smoothed linear/radial gradient matches the preview.

- [ ] **Step 3: Confirm no stray console errors**

Verify the browser console is clean while toggling Smooth across geometry types.

---

## Self-review notes

- **Spec coverage:** oklch (Task 1), smoothStops (Task 2), buildGradientCss scope + hard-wins + square-skip (Task 3), state + codec (Task 4), SVG export (Task 5), raster export (Task 6, with documented linear/radial scope), UI + mutual exclusion (Task 7), all previews (Task 8), verification (Task 9). All spec sections map to a task.
- **Naming consistency:** `smoothStops`, `SMOOTH_SAMPLES_PER_SEGMENT`, `blendOklabHex`, `smoothEnabled`, `filters.smooth`, `onToggleSmooth`, `handleToggleSmooth`, `data-testid="filter-smooth"` used consistently across tasks.
- **Known limitation (documented):** raster export smooths only the linear/radial paths; conic/mirror raster paths keep current behavior. CSS previews and SVG export cover all continuous types.
