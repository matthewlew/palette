export type HueFamily =
  | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green'
  | 'teal' | 'cyanBlue' | 'blue' | 'violet' | 'purple' | 'pink' | 'neutral'

export type LightnessBand = 'dark' | 'mid' | 'light'
export type Mood = 'muted' | 'soft' | 'vivid'

// Color nouns keyed by [family][band]. Every family has all three bands
// filled; lists are intentionally short (3-4 words) — the naming function
// picks one, it doesn't need breadth beyond avoiding obvious repetition.
export const COLOR_NOUNS: Record<HueFamily, Record<LightnessBand, string[]>> = {
  red: {
    dark: ['Doom', 'Ox-Blood', 'Ember'],
    mid: ['Brick', 'Rooibos', 'Paprika'],
    light: ['Petal', 'Shell', 'Coral'],
  },
  orange: {
    dark: ['Rust', 'Copper', 'Amber Ash'],
    mid: ['Marmalade', 'Terracotta', 'Persimmon'],
    light: ['Peach', 'Apricot', 'Melon'],
  },
  amber: {
    dark: ['Whiskey', 'Tobacco', 'Bronze'],
    mid: ['Amber', 'Caramel', 'Ochre'],
    light: ['Honey', 'Butterscotch', 'Wheat'],
  },
  yellow: {
    dark: ['Ochre', 'Bee', 'Dijon'],
    mid: ['Mustard', 'Honeycomb', 'Saffron'],
    light: ['Toast', 'Butter', 'Straw'],
  },
  lime: {
    dark: ['Olive', 'Fern', 'Moss Bark'],
    mid: ['Chartreuse', 'Pear', 'Sprig'],
    light: ['Spring Leaf', 'Sprout', 'Pistachio'],
  },
  green: {
    dark: ['Juniper', 'Forest', 'Kelp'],
    mid: ['Moss', 'Fig Leaf', 'Matcha'],
    light: ['Celadon', 'Mist', 'Sprout'],
  },
  teal: {
    dark: ['Pine', 'Deep Lagoon', 'Malachite'],
    mid: ['Teal', 'Verdigris', 'Lagoon'],
    light: ['Sea Glass', 'Aqua', 'Spearmint'],
  },
  cyanBlue: {
    dark: ['Fathom', 'Abyss', 'Ink Well'],
    mid: ['Harbor', 'Cerulean', 'Slate'],
    light: ['Powder', 'Glacier', 'Sky'],
  },
  blue: {
    dark: ['Midnight', 'Ink', 'Navy'],
    mid: ['Denim', 'Delft', 'Cobalt'],
    light: ['Dawn', 'Periwinkle', 'Chicory'],
  },
  violet: {
    dark: ['Eclipse', 'Nightshade', 'Damson'],
    mid: ['Iris', 'Violet Hour', 'Wisteria'],
    light: ['Lilac', 'Lavender', 'Hazy Bloom'],
  },
  purple: {
    dark: ['Aubergine', 'Plum', 'Mulberry'],
    mid: ['Orchid', 'Amethyst', 'Grape'],
    light: ['Heather', 'Thistle', 'Orchid Mist'],
  },
  pink: {
    dark: ['Garnet', 'Berry', 'Sangria'],
    mid: ['Rose', 'Peony', 'Guava'],
    light: ['Blush', 'Cotton Candy', 'Bellini'],
  },
  neutral: {
    dark: ['Charcoal', 'Basalt', 'Soot'],
    mid: ['Clay', 'Pumice', 'Loam'],
    light: ['Bone', 'Oat', 'Chalk'],
  },
}

// Place/thing words, family-agnostic in general but with optional affinities
// that get preferred when present.
export interface PlaceThing {
  word: string
  families?: HueFamily[]
  moods?: Mood[]
}

export const PLACE_THINGS: PlaceThing[] = [
  { word: 'Amalfi', families: ['yellow', 'orange', 'blue'] },
  { word: 'Kyoto', families: ['pink', 'green'] },
  { word: 'Tangier', families: ['amber', 'orange'] },
  { word: 'Reykjavik', families: ['cyanBlue', 'blue', 'neutral'], moods: ['muted'] },
  { word: 'Marrakesh', families: ['red', 'orange', 'amber'] },
  { word: 'Vespers' },
  { word: 'Apothecary', moods: ['muted', 'soft'] },
  { word: 'Solstice' },
  { word: 'Verandah' },
  { word: 'Grove', families: ['green', 'lime'] },
  { word: 'Tidepool', families: ['teal', 'cyanBlue'] },
  { word: 'Sunset', families: ['red', 'orange', 'pink'] },
  { word: 'Sonnet' },
  { word: 'Fable' },
  { word: 'Arcade' },
  { word: 'Atlas' },
  { word: 'Meridian' },
]

// Modifiers keyed by mood.
export const MODIFIERS: Record<Mood, string[]> = {
  muted: ['Quiet', 'Sleeping', 'Faded', 'Dusty', 'Hushed'],
  soft: ['Wandering', 'Morning', 'Folded', 'Tender'],
  vivid: ['Running', 'Electric', 'Feral', 'Loud'],
}
