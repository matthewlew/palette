# Palette Name Generator — Design Spec (plan only)

Date: 2026-07-07
Status: Approved design; implementation deferred to a future session.

## Goal

Every palette gets a cute, evocative, deterministic name — e.g. "Tree Amalfi Toast", "Running Doom Sunset". Aesop-inspired vocabulary: botanical, geographic, sensory, slightly odd word pairings. Fully local (no API), pure functions, deterministic per palette.

## Overview

A pure function:

```ts
// src/lib/naming.ts
export function namePalette(hexes: string[]): string
```

It classifies the palette's colors, pulls candidate words from keyword banks keyed by those classifications, and assembles a 2–3 word name using a seeded RNG derived from the hex values (same palette → same name, always).

## Step 1: Classify colors

For each hex, compute OKLCH via existing `hexToOklch` and derive three tags:

- **Hue family** (12 buckets): red [350–20), orange [20–55), amber [55–75), yellow [75–105), lime [105–130), green [130–165), teal [165–200), cyan-blue [200–240), blue [240–275), violet [275–305), purple [305–330), pink [330–350). If chroma < 0.03, family = `neutral` instead.
- **Lightness band**: `dark` (l < 0.35), `mid` (0.35–0.7), `light` (> 0.7).
- **Mood** (from chroma): `muted` (c < 0.06), `soft` (0.06–0.12), `vivid` (> 0.12).

Palette-level features: **dominant family** (most frequent hue family), **accent family** (most chromatic outlier), overall lightness band (average), overall mood (max chroma).

## Step 2: Word banks

Three banks, stored as plain data in `src/lib/namingWords.ts`.

**A. Color nouns** — keyed by `family × lightness band`. Examples (each cell needs 6–10 words):

| | dark | mid | light |
|---|---|---|---|
| yellow | Ochre, Bee, Dijon | Mustard, Honey, Saffron | Toast, Butter, Straw, Custard |
| red | Doom, Ox-Blood, Ember | Brick, Rooibos, Paprika | Petal, Shell, Coral |
| green | Juniper, Forest, Kelp | Moss, Fig Leaf, Matcha | Celadon, Mist, Sprout |
| blue | Midnight, Fathom, Ink | Denim, Harbor, Delft | Powder, Glacier, Dawn |
| neutral | Charcoal, Basalt, Soot | Clay, Pumice, Loam | Bone, Oat, Chalk, Linen |
| ... | (all 12 families + neutral filled in at implementation time) | | |

**B. Place & thing words** (Aesop flavor, family-agnostic but tagged with affinities): Amalfi, Kyoto, Tangier, Reykjavik, Marrakesh, Vespers, Apothecary, Solstice, Verandah, Grove, Tidepool, Umber, Sunset, Sonnet, Fable, Arcade, Atlas, Meridian. Each entry lists optional `families` and `moods` it pairs with (e.g. Amalfi → yellow/orange/blue; Reykjavik → cool families + muted).

**C. Modifiers** (verbs/adjectives, keyed by mood): 
- muted: Quiet, Sleeping, Faded, Dusty, Hushed
- soft: Wandering, Morning, Folded, Tender
- vivid: Running, Electric, Feral, Loud, Neon

## Step 3: Assembly

Seed: FNV-1a hash of `hexes.join(',')` feeding a mulberry32 PRNG (both tiny, well-known, copy-paste implementations — no dependency).

Templates (pick one by seed):
1. `[Modifier] [PlaceThing] [ColorNoun]` → "Running Doom Sunset" style
2. `[ColorNoun] [PlaceThing] [ColorNoun]` → "Tree Amalfi Toast" style (first noun from accent family, second from dominant)
3. `[Modifier] [ColorNoun]` (2-word fallback when banks are thin)

Rules:
- Words drawn without replacement; never repeat a word in one name.
- PlaceThing candidates filtered to entries whose affinities include the palette's dominant family or mood; if the filter empties the list, use the unfiltered list.
- Deterministic: same input hexes (same order) → same name.

## Step 4: Integration (future session)

- Add `name?: string` to the `Gradient` type; call `namePalette` at generation time in the feed and when saving.
- Display: overlay on feed card (small caps, bottom-left) and edit-mode header.
- Persisted names stay stable because they're stored on the saved gradient.

## Testing plan

- Determinism: same hexes → identical name across calls.
- Classification: known hexes land in expected family/band/mood.
- Coverage: for 200 random palettes, `namePalette` never throws, never returns repeated words in one name, name length 2–3 words.
- Vocabulary review: snapshot 20 sample names in a test for human eyeballing.

## Out of scope

- LLM/API-based naming.
- Localization.
- User-editable names (worth adding later in edit mode).
