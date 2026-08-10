# Drum — Product Requirements Document (v0.2)

**Status:** draft, not approved. No code has been written. No branch beyond this doc, no PR against it yet.
**Owner:** Matthew
**Primary reviewer:** Jenny (구자연) — practicing riso printmaker, the design partner for this
**Purpose of this doc:** a single source of truth, iterated through three parallel spec/build sessions (mockups, engineering spec, aesthetic-scorer analysis) and one competitor-app review, now folded back in. Hand this to Claude Code as an implementable spec.

---

## 0. How to use this document

This PRD is deliberately split into **Decided**, **Open**, and **Explicitly out of scope**. When developing it further:

- Push on anything in **Open** — those are real forks in the road, not rhetorical ones.
- Treat **Decided** items as load-bearing. Several were reversed once already after research; each reversal cost a rebuild. If you want to reopen one, say why in terms of user harm, not preference.
- Do not add features to **Out of scope** without removing something. Scope creep is the identified failure mode of this project so far.

---

## 1. Problem

Risograph printing does not work like screen colour. A riso press has one ink drum at a time; each ink is a physically separate pass, and the artwork must be delivered as **one grayscale file per ink**, where black means 100% ink coverage and white means bare paper. Colour comes from the drum in the machine, not from the file.

Designers who want gradients for riso therefore face a translation problem: they design in RGB, then try to reverse-engineer separations out of a colour image. The results are unpredictable, and the common workarounds are worse than they look.

**The concrete case that started this.** Jenny prints postcards on Fluorescent Pink / Cornflower / Yellow. Her current workflow is to build an RGB gradient and split it into R, G, B channels as separations. This appears to work — but only because she designs on a black background. The moment a composition includes paper white, the channel split produces coverage where there should be none, and the print comes back muddy. The workflow has a hidden precondition its user does not know about.

**The market gap.** The one real tool in this space, Spectrolite (free, Mac/Windows, by ANEMONE), separates *existing* artwork. It cannot author a gradient. Its ICC-matching approach is also the source of the "ghosting" complaint that recurs in printmaker forums. There is no web-based, platform-agnostic, gradient-native riso tool.

**The asset we already have.** `palette` is a working gradient generator with a tuned aesthetic scorer, a share/export codec, and a design system. Everything about the *shape* of a gradient — type, angle, stop positions, easing — is already solved and is identical for riso. Only the colour model differs.

---

## 2. Users

| | Who | What they need | What breaks them today |
|---|---|---|---|
| **Primary** | Practicing riso printmakers (Jenny) | Author a gradient directly in ink coverage; see an accurate overprint preview; export lab-ready plates | Guessing at separations; muddy prints; no preview of overprint |
| **Secondary** | Art students with lab access (SVA, SAIC, university print labs) | Something they can use before they understand riso; not a technical gauntlet | Onboarding that front-loads press theory kills interest |
| **Tertiary** | Existing `palette` users who happen to print | A path from a gradient they already made to something printable | No path exists |

**Design principle drawn from the secondary group:** let people discover riso, don't make them qualify for it. An early version gated entry behind a drum-selection screen; this was cut. Interest first, constraints later.

---

## 3. Decided

These are settled. Each has a reason attached because each was contested at some point.

### 3.1 Two products, not one mode

`palette` and `Drum` are separate products with separate entry points, sharing an engine.

*Why:* a mode toggle means every user answers "RGB or riso?" on every create. The user's words: *"getting asked riso or rgb is exhausting."* It also means every screen in `palette` carries riso conditionals forever.

`palette`'s `+` button stays pure RGB. There is no fork, no mode switch, no gate.

### 3.2 The product is called **Drum**

RISOGRAPH is a live registered trademark of Riso Kagaku. Nominative fair use permits *"gradients for Risograph printing"* as a description; it does not permit it as a product name.

"Ris0" was considered and rejected: deliberate misspelling fails on likelihood-of-confusion, reads as bad faith to a court, invites UDRP/ACPA action, and is unsearchable and unsayable.

"Drum" is community-native — it appears in studio glossaries, university lab guides, RISO's own manuals ("print drum (cylinder)"), and the parts market ("Color Drum").

Domain target: `drum.ink` — **availability still unchecked**, along with a trademark knockout search on "Drum" in the relevant classes. Both are blocking items before any public launch, not before internal build.

**SEO note:** discoverability lives in the page title, H1, and body copy — *"Gradients for Risograph printing"* — not in the product name. There is nothing to gain from putting "Riso" in the name.

### 3.3 Cross-links, not conversion

- **palette → Drum:** a link in the export sheet reading **"Risograph printing? Make it in Drum →"**. ("Printing this?" was rejected — bare "printing" reads as inkjet.)
- **Drum → palette:** a Drum gradient converts to `palette` free and losslessly, because the hex is already authoritative and coverage is additive metadata.
- **palette → Drum conversion is deliberately cut.** RGB→riso is the lossy direction. Offering it would reproduce exactly the guesswork this product exists to eliminate.

### 3.4 Coverage is authored, hex is derived

The user works in ink percentages. The rendered colour is computed from them, never the reverse.

The ink model is a translucent multiply, applied **lightest ink first**:

```
film = 255 - a * (255 - ink)
out  = bg * film / 255
```

**Correction (spec-analysis session, verified by brute-force comparison of three orderings of the same coverage triple, agreeing to 13 decimal places):** ink order does **not** affect output — the multiply formula is a product of independent per-ink factors and commutes. "Lightest ink first" is kept as a code convention for readability and consistency, not because it's a rendering-correctness requirement. If a colour bug ever shows up, reordering will not fix it — look elsewhere.

### 3.5 Verified press constraints

Every number below was confirmed against printmaker forums, studio guides, and multiple rounds of external research, including a public riso-studio reference page (Secret Riso Club's "Riso Basics"). Several corrected earlier mistakes of mine — noted where relevant.

| Constraint | Value | Note |
|---|---|---|
| Single-ink ceiling | 80% | above this, ink saturates the paper |
| **Total cross-layer ink** | **150–180%** | **corrected.** I had 240%, borrowed from offset. It is actively harmful and self-contradictory with an 80% single cap (3 × 80 = 240 would ruin prints) |
| Gradient floor | 10% | below this the ink drops out entirely |
| **Large solid-fill opacity** | **50%** | **new, from Secret Riso Club.** Stricter than the general 80% single-ink ceiling — applies specifically to large areas of flat, solid ink coverage, not gradients generally. A caveat layered on top of the 80% rule, not a replacement for it |
| Registration tolerance | 1–4mm | pass-to-pass drift is inherent to the format |
| Trapping | 1–2mm | to survive registration drift |
| Safe margin | 5–10mm | |
| Unprintable border | ~0.25″ (also seen as **1/4–1/2″ bleed**, Secret Riso Club) | hardware limit; the two figures are consistent, treat 1/4″ as the floor and 1/2″ as the conservative default |
| **Leading-edge light zone** | **10–15mm** | **corrected.** I had reported a "50–60mm rule" that conflated two constraints. Heavy ink at the leading edge defeats the stripper claws and the paper wraps the drum |
| Centre-spine roller track | avoid heavy ink | separate constraint from the above |
| Default line screen | 71 LPI | applied by the lab's driver |
| Screen angles | 15/45/75, or 15–30° offset | |
| Dither noise | 1.5–5% | breaks 8-bit banding in long gradients |

**Gamut math.** Coverage steps `[0, 10, 20, 40, 60, 80, 100]` across 3 inks = 343 combinations. The 80% single cap removes 127 → 216. Adding a 180% total cap → 206. At 150% → 178.

### 3.6 Export target

- **Grayscale PDF preferred**, TIFF acceptable, PNG only if flattened onto white
- 300dpi minimum, 600dpi preferred
- **Zero transparency, zero alpha** — the most common lab rejection
- Ink name in the filename (`postcard_fluorescent-pink.pdf`)
- **Halftoning is optional and out of scope.** This flip-flopped three times. Final answer: labs apply 71 LPI at the driver, so we ship continuous-tone grayscale and let the driver screen it.

### 3.7 Coverage lives at gradient level, not per stop

This is a hard constraint discovered in the codebase, not a preference. `importGradient` in `src/lib/gradientCodec.ts` rebuilds stops explicitly:

```ts
stops: g.stops.map((s) => ({ hex: s.hex, position: s.position }))
```

with a comment stating this is deliberate, so hand-crafted payloads cannot smuggle keys into persisted state. **Any `coverage` field placed on a stop object is silently destroyed on every import.** Coverage must therefore be a gradient-level array parallel to `stops`.

**Confirmed by engineering-spec analysis, with two additional implementation-critical facts:**

- The codebase actually has **two different notions of "stops"**: an id-keyed editable working set (`EditableStop` in `stopOrdering.ts`, `{id, hex, position}` — drag-reorder needs stable identity) and the persisted, id-less, position-sorted `Gradient.stops` array (`{hex, position}`). These desync at a point that isn't obvious from the store type alone. Drum needs its own parallel editable type (`DrumEditableStop = {id, coverage: number[]}`), deliberately **not** a generic fork of `stopOrdering.ts` — forking would mean riso conditionals forever, which §3.1 already rules out for `palette`'s side; the same logic applies here in reverse.
- The single highest-risk bug surface in this whole feature: **the coverage-array commit sort must use the exact same sort operation as the hex-stop commit sort** (`toGradientStops`), not an independently re-derived one. If they drift, coverage and hex silently point at different stops.
- Hex is derived live on every edit (cheap at 3-ink scale, no debounce needed) and written into `gradient.stops[i].hex` on commit — never stale in exported/shared state.
- **On import, a hex/coverage mismatch should be flagged as a validation error, not silently recomputed.** Recomputing would hide a real bug (e.g. a future ink-catalogue hex change slipping through unnoticed).
- The stop-row UI should show **coverage percentages, not hex**, mirroring `palette`'s "never hide the ground truth" principle — for Drum, coverage *is* the ground truth; hex is derived and should read as visually secondary in the row.

### 3.8 No calibration

Screen-to-press colour calibration, including phone-camera-based calibration, is out. Confirmed by the user. The preview is a good-faith simulation, labelled as such.

A **misregistration-preview toggle** (illustrative drift simulation, not accuracy-claiming, inspired by a competitor app — see §10) is a distinct, smaller claim than calibration and does not violate this decision. It is a v2 candidate (§7), not part of this rule.

---

## 4. What is shared, configured, and separate

The governing rule, which resolves every case:

> **Anything about the *shape* of a gradient is shared. Anything about what a *colour is* is separate.**

| Layer | Disposition | Notes |
|---|---|---|
| Gradient geometry (type, angle, stops, easing, fan anchor) | **Shared** | verbatim, no changes |
| Generation engine (`generateGradientStops`, candidate + weighted-random pick) | **Shared, with one addition** | `CANDIDATE_COUNT = 8`, weighted by `score²`. **Confirmed:** `generateGradientStops` itself hardcodes Oklch and does not transfer — jittering in Oklch and reverse-solving for coverage is underdetermined and doesn't work. Drum needs a parallel `generateGradientCoverage` with its own coverage-space jitter function, same shape as the existing generator, not shared code |
| Scoring (`scorePalette`) | **Configured — confirmed to transfer as-is** | already accepts a `weights` argument, so riso rebalances without forking. See §9 for the full transfer analysis |
| Share/export codec | **Configured** | one added optional key |
| Design system (LDS) | **Configured** | palette rests dark, Drum rests light; same tokens |
| Supabase `palettes` table | **Configured** | one added nullable column |
| Tab bar, gallery, edit surfaces | **Shared** | Gallery renders *first*, then Create — matching `TabBar.tsx` |
| **Colour model (coverage ↔ hex)** | **Separate** | real work |
| **Plate exporter** | **Separate** | real work — reuses `renderGradientToCanvas` as a wrapper, see §6 item 4 |
| Ink catalogue / drum picker | **Separate** | data + UI |
| Preflight warnings | **Separate** | block-vs-warn split, see §6 item 3 |
| Landing page, domain, OG previews | **Separate** | |

**Of everything listed, only two items are substantial engineering:** the coverage colour model and the plate exporter. Everything else is configuration or reuse. This is the core argument for the two-product split being cheap rather than expensive.

---

## 5. Data model, URLs, and compatibility

### 5.1 JSON export

`palette` exports via `toExportJson` → `{ kind: 'gradient' | 'board', gradients: [...] }`. Drum uses **the same envelope with one added key**:

```json
{
  "type": "linear",
  "stops": [{ "hex": "#EFD35C", "position": 0 }],
  "name": "Straw",
  "riso": {
    "inks": ["Fluorescent Pink", "Cornflower", "Yellow"],
    "coverage": [[10, 5, 60], [70, 0, 35], [40, 80, 0]]
  }
}
```

`hex` stays populated and correct. It is derived from coverage, never authored — but never absent, because it is what `palette` renders from and what the validator checks.

### 5.2 URLs — nothing breaks

Three forms exist today:

| Form | Mechanism | Impact |
|---|---|---|
| `#d=<base64url>` | self-contained payload, imported then stripped via `history.replaceState` | **None.** The codec is an allowlist, so adding `riso` is purely additive — old links lack the key and stay valid; older builds drop it. Forward- and backward-compatible with no version bump. Same path the removed `flutedEnabled` already took |
| `#<slug>` | Supabase lookup on the `palettes` table | **Needs one nullable `riso jsonb` column.** Current columns (`slug`, `colors`, `offsets`, `shape`, `angle`, `display_name`, `id`) have nowhere to put ink identity. Existing rows read `null` and behave exactly as now |
| `/palette/g/<slug>.html` | prerendered OG page from `scripts/gen-previews.mjs` | Drum needs its own copy of the generator and OG image renderer. Existing palette pages untouched |

**Unexpected upside:** both products read the same Supabase table, so slugs form **one namespace, portable across both domains**. `drum.ink/#a7f3` and `matthewlew.github.io/palette/#a7f3` resolve to the same gradient — palette shows the colours, Drum shows the recipes.

### 5.3 Two risks that need a decision

**Silent round-trip data loss.** The allowlist that makes this safe also makes it lossy. Open a Drum link in `palette`, save, re-share — the `riso` block is gone permanently, with no error shown to anyone.

*Proposed mitigation:* when `palette` imports a payload carrying `riso`, keep the key on the object even though nothing reads it, and show a small **"made in Drum ↗"** chip. Costs one allowlist entry; stops the data evaporating in the most likely sharing path.

**Validation is a security boundary, not a formality.** `isSharePayloadGradient` carries a comment explaining that hex strings are interpolated into CSS `backgroundImage`, where a crafted value could inject `url()` and leak a viewer's IP. Ink hexes would be interpolated into canvas fills. The `riso` block therefore needs the same discipline: ink names from a known list or strict `#rrggbb`, coverage clamped 0–100, array length matching `stops`.

---

## 6. Proposed v1 scope

Four items. The scope-control mechanism is that adding a fifth requires removing one.

1. **Drum picker** — full-colour swatch grid of the ink catalogue. Selection is an additive ring + badge, **never a fade**. (Direct user feedback: dimming unselected inks means you can't preview the colours you're choosing between.) Selected inks render as a separate named list (swatch, full name, abbreviation, ✕) distinct from the full browse grid.
2. **Coverage-native generation and editing** — the existing generator producing coverage triples instead of hexes (via a new `generateGradientCoverage`, see §4), with the overprint preview rendered from the multiply model. Stop rail shows a colour dot only, no raw floating text; edit panel shows coverage percentages as ground truth, hex demoted. **Unsolved:** the edit panel's coverage grid only draws cleanly for 2 dominant inks (a 7×7 matrix); a 3rd ink currently rides a side bar with no true third axis. This needs either a real design pass or an explicit call that it's good enough for the proposal stage — not yet resolved.
3. **Preflight** — **not uniformly warn.** Alpha-channel presence and DPI below 300 are **hard blocks** (labs reject these outright, no legitimate reason to override). Every ink-coverage-related check — 80% ceiling, 180% total, 10% floor, 50% large-fill opacity, leading-edge, roller track, margin — is a **warning only**, since those are artwork judgment calls.
4. **Plate export** — one grayscale PDF per ink at 600dpi, flattened, ink-named. Reuses `renderGradientToCanvas` as a wrapper: per ink, substitutes stop hex for a grayscale value. **Landmine:** the existing renderer fills a black base by default, correct and invisible for RGB — for a grayscale plate this must be a **white base** (bare paper), or every 0%-coverage area renders as full ink. Requires a new PDF-embedding dependency not currently in the repo (`pdf-lib` suggested) — flag for explicit sign-off before adding.
   - **Companion idea, not yet in scope:** a separations-preview screen (drag-to-fan plate stack, per-ink tabs, explicit "viewing only, export always prints composite") — see §10. Could fold into this item or ship as a small companion screen.

**Explicitly out of v1:** halftone screening, calibration, RGB→riso conversion, per-stop coverage, drum-swap sequencing UI, imposition, multi-page documents.

---

## 7. Open questions

Push on these.

1. ~~Does the aesthetic scorer transfer?~~ **Substantially answered — see §9.** Short version: yes, don't reweight for v1, but the generated palette will look structurally washed-out with this specific 3-ink set (no dark ink in Fluorescent Pink / Cornflower / Yellow).
2. **Is the ink catalogue 79 inks or the drums a given lab actually owns?** Showing all 79 is honest but mostly aspirational for a student with three drums. Is there a "my studio" concept in v1, or is that v2?
3. **How do you pick 3 inks from 79 without a search field?** A grid of 79 swatches is browsable; a grid of 79 swatches you're trying to find "Aqua" in is not.
4. **Should the two products actually share a Supabase table?** It gives free slug portability, but it also couples deployments and means a Drum schema change touches palette's data.
5. **Does Drum need accounts at all in v1,** or is share-by-link sufficient the way it is for palette?
6. **What is the acceptance test for "the preview matches the print"?** Without calibration, what claim are we willing to make, and how would Jenny falsify it?
7. **`drum.ink` availability** — needs checking, along with a trademark knockout search on "Drum" in the relevant classes.
8. **New, from the scorer-transfer analysis:** should ink-set selection warn when the chosen inks have no dark member (i.e. flag a structural lightness ceiling before the user generates and is disappointed)? No decision yet — plausible v1 nicety, not required.
9. **New, from the Inkling competitor review:** should a "Register · off on purpose" misregistration-preview toggle (illustrative drift simulation, explicitly not accuracy-claiming — distinct from the ruled-out calibration feature in §3.8) be a v2 candidate? Leaning yes, not yet decided against the add-one-remove-one rule.

---

## 8. Success criteria

- Jenny prints a postcard from Drum plates without hand-editing files between export and lab.
- A student who has never separated artwork produces a printable 3-ink gradient in under five minutes without reading documentation.
- Zero existing `palette` share links break.
- No lab rejects a Drum export for transparency, resolution, or colour mode.

---

## 9. Does the aesthetic scorer transfer to riso's gamut?

Full analysis from a dedicated spec-analysis pass, brute-forcing all 206 reachable coverage triples for the concrete ink set (Fluorescent Pink `#ff48b0` / Cornflower `#62a8e5` / Yellow `#ffe800` — hexes cross-referenced against a standard dev riso-colour reference, approximate, "good enough for architecture, not press-calibration"). The real `scorePalette` was run against this gamut and against `palette`'s actual 78-swatch pool as baseline.

**Per-weight verdict:**

- `lightnessRange` (0.35, the dominant weight) — **structurally capped, not just weaker.** No combination of these three inks reaches genuine darkness: none of the three base inks is dark (Yellow L 0.92, Cornflower 0.71, Pink 0.69; the darkest reachable point in the whole gamut is `#814e8d`, a medium violet). Max reachable lightness-contrast is ~0.62 vs ~0.96 in the RGB baseline. **This is specific to this ink set, not riso in general** — a set including a dark/navy ink would plausibly not have this problem.
- `minPairwiseDistance` (0.30) — transfers fine, arguably more load-bearing (riso's 206 points cluster more than the baseline — 11.9% near-duplicate pairs vs 6.0% in the baseline — so this term does real discriminating work).
- `achromaticPenalty` (0.15) — transfers correctly and validates a real concern: 10 of 206 points are near-neutral/muddy, matching the "muddy print" failure mode described in §1.
- `saturationSpread` (0.12) — modestly compressed, same order of magnitude, fine.
- `hueHarmony` (0.08) — nearly unchanged (mean 0.828 riso vs 0.822 baseline); hue coverage spans almost the whole wheel, with one real hole around teal/cyan (none of the three inks nor their overprints land there).

**Selection mechanism still works**, because `scorePalette` is only ever used ordinally in the codebase (weighted-random pick via `pickByScore`, tests only compare `>`) — nothing reads it as an absolute number. The compressed range doesn't functionally break generation.

**Recommendation: don't reweight for v1.** The mechanism works; scores are lower in absolute terms but that's expected, not broken. The real product question this surfaces: **a generated Drum gradient may look structurally washed-out/pastel to Jenny**, because the scorer's most important axis is asking for something these three specific inks can't deliver. Concrete next experiment, not a blind reweight: test whether a different 3-ink set that *includes* a dark ink produces an RGB-like distribution (answerable without Jenny), and separately, get Jenny's actual reaction to a "washed out" gradient on printed samples before deciding whether this needs a fix at all. See §7 item 8 for the related open question about warning on dark-less ink sets.

---

## 10. Competitor/reference review: Inkling

Inkling is a photo-to-print-simulator: it takes an **existing photo** and simulates how it would look under different print processes (Colour Riso, Risograph, Newsprint, Screen Print) via a "Process" picker, then shows per-plate separations. It does not author gradients from scratch — a fundamentally different shape of product than Drum, so its core interaction (the Process picker) doesn't map over.

Two UI patterns worth borrowing:

1. **Separations viewer** — a drag-to-fan stack of plates, Composite/C1/C2/C3 tabs, with an explicit "viewing only — export always prints the composite" label. Drum's plate-export step (§6 item 4) currently has no preview screen for individual plates before export; this is a clean pattern to add there or as a companion screen.
2. **"Register · off on purpose"** — a misregistration-preview slider simulating realistic press drift, explicitly separate from the exported file, illustrative rather than accuracy-claiming. Distinct from the calibration feature already ruled out in §3.8. Candidate for §7 as a v2 idea, not v1 scope.

Also reviewed: Secret Riso Club's public "Riso Basics" page, a real riso lab's guide. It confirmed the general copy-tone approach used in the current mockups (short, declarative, mechanism-before-consequence) and surfaced two numbers now folded into §3.5: a **1/4–1/2″ bleed border** (consistent with the existing ~0.25″ figure) and a **50% max opacity for large solid-fill areas** (a stricter caveat layered on the general 80% single-ink ceiling).

---

## 11. Prior artifacts

| Doc | State |
|---|---|
| `riso-proposal.html` | Rebuilt against the decisions above (see mockup-rebuild session). Latest artifact: `https://claude.ai/code/artifact/d1ecf31b-800d-411f-950f-0ed3c921cf78` |
| `riso-mockup.html` | Rebuilt against the decisions above (see mockup-rebuild session). Latest artifact: `https://claude.ai/code/artifact/2db4a517-bbbf-4a70-a2c2-9360668c0df3`. **Still owed:** a human eyeball pass on the live URL — the rebuild session verified layout via DOM/CSS inspection only, not rendered pixels |
| `two-products.html` | Current as of the prior round. Five screens plus a 17-row comparison table |

**Still owed before anything goes to Jenny:** the eyeball pass above, `drum.ink` availability check, trademark knockout search on "Drum" (§3.2).
