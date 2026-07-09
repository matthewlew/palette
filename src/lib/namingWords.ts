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

// Grouped loosely by register — places, times of day, weather, landscape,
// botanicals, textures, and scents — in the spirit of Werner's Nomenclature
// and paint-chip naming: concrete sensory nouns that carry a color without
// describing one.
export const PLACE_THINGS: PlaceThing[] = [
  // Places
  { word: 'Amalfi', families: ['yellow', 'orange', 'blue'] },
  { word: 'Kyoto', families: ['pink', 'green'] },
  { word: 'Tangier', families: ['amber', 'orange'] },
  { word: 'Reykjavik', families: ['cyanBlue', 'blue', 'neutral'], moods: ['muted'] },
  { word: 'Marrakesh', families: ['red', 'orange', 'amber'] },
  { word: 'Apothecary', moods: ['muted', 'soft'] },
  { word: 'Verandah' },
  { word: 'Arcade' },
  { word: 'Atlas' },
  { word: 'Meridian' },
  { word: 'Sonnet' },
  { word: 'Fable' },
  // Time of day
  { word: 'Vespers', moods: ['muted', 'soft'] },
  { word: 'Matins', moods: ['soft'] },
  { word: 'Gloaming', families: ['violet', 'purple', 'blue', 'neutral'], moods: ['muted', 'soft'] },
  { word: 'Daybreak', families: ['pink', 'orange', 'yellow'], moods: ['soft'] },
  { word: 'Noonday', families: ['yellow', 'amber'], moods: ['vivid'] },
  { word: 'Twilight', families: ['violet', 'blue', 'purple'] },
  { word: 'Solstice' },
  { word: 'Equinox' },
  // Weather
  { word: 'Mizzle', families: ['neutral', 'cyanBlue', 'green'], moods: ['muted'] },
  { word: 'Haar', families: ['neutral', 'cyanBlue'], moods: ['muted'] },
  { word: 'Zephyr', moods: ['soft'] },
  { word: 'Sirocco', families: ['amber', 'orange', 'red'] },
  { word: 'Squall', families: ['cyanBlue', 'blue', 'neutral'], moods: ['vivid'] },
  { word: 'Monsoon', families: ['teal', 'green', 'blue'] },
  { word: 'Thaw', moods: ['soft', 'muted'] },
  { word: 'Nimbus', families: ['neutral', 'cyanBlue'] },
  // Landscape
  { word: 'Moor', families: ['green', 'purple', 'neutral'], moods: ['muted'] },
  { word: 'Fjord', families: ['teal', 'cyanBlue', 'blue'] },
  { word: 'Tarn', families: ['teal', 'blue', 'neutral'], moods: ['muted'] },
  { word: 'Dune', families: ['amber', 'yellow', 'neutral'] },
  { word: 'Heath', families: ['green', 'purple', 'lime'] },
  { word: 'Estuary', families: ['teal', 'cyanBlue', 'neutral'] },
  { word: 'Orchard', families: ['green', 'lime', 'red'] },
  { word: 'Grove', families: ['green', 'lime'] },
  { word: 'Tidepool', families: ['teal', 'cyanBlue'] },
  { word: 'Sunset', families: ['red', 'orange', 'pink'] },
  { word: 'Prairie', families: ['amber', 'yellow', 'lime'] },
  { word: 'Bayou', families: ['green', 'teal'], moods: ['muted'] },
  // Botanical
  { word: 'Yarrow', families: ['yellow', 'lime'] },
  { word: 'Sorrel', families: ['green', 'lime', 'red'] },
  { word: 'Bracken', families: ['green', 'amber', 'orange'], moods: ['muted'] },
  { word: 'Clover', families: ['green', 'lime', 'pink'] },
  { word: 'Hollyhock', families: ['pink', 'purple', 'red'] },
  { word: 'Alder', families: ['green', 'neutral'], moods: ['muted'] },
  { word: 'Willow', families: ['green', 'lime', 'neutral'], moods: ['soft', 'muted'] },
  // Texture
  { word: 'Velvet', moods: ['vivid', 'soft'] },
  { word: 'Linen', moods: ['muted', 'soft'] },
  { word: 'Gossamer', moods: ['soft'] },
  { word: 'Patina', families: ['teal', 'green', 'neutral'], moods: ['muted'] },
  { word: 'Raku', families: ['neutral', 'amber'], moods: ['muted'] },
  // Scent
  { word: 'Petrichor', families: ['neutral', 'green', 'cyanBlue'], moods: ['muted'] },
  { word: 'Vetiver', families: ['green', 'amber'], moods: ['muted'] },
  { word: 'Bergamot', families: ['yellow', 'lime', 'green'] },
  { word: 'Myrrh', families: ['amber', 'orange', 'neutral'] },
  { word: 'Chai', families: ['amber', 'orange', 'neutral'], moods: ['soft', 'muted'] },
]

// Modifiers keyed by mood — experiential and textural adjectives (how a
// palette feels, weathers, or catches light), not color words.
export const MODIFIERS: Record<Mood, string[]> = {
  muted: ['Quiet', 'Sleeping', 'Faded', 'Dusty', 'Hushed', 'Weathered', 'Fogbound', 'Worn', 'Overcast', 'Sun-Faded'],
  soft: ['Wandering', 'Morning', 'Folded', 'Tender', 'Gauzy', 'Milky', 'Honeyed', 'Half-Lit', 'Drowsy'],
  vivid: ['Running', 'Electric', 'Feral', 'Loud', 'Molten', 'Sunstruck', 'Ripe', 'Burning'],
}
