export type HueFamily =
  | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green'
  | 'teal' | 'cyanBlue' | 'blue' | 'violet' | 'purple' | 'pink' | 'neutral'

export type LightnessBand = 'dark' | 'mid' | 'light'
export type Mood = 'muted' | 'soft' | 'vivid'

// Color nouns keyed by [family][band]. Six-ish per band so names don't
// repeat across a gallery of saves; single short words people actually
// write — paint-chip register, not perfume copy.
export const COLOR_NOUNS: Record<HueFamily, Record<LightnessBand, string[]>> = {
  red: {
    dark: ['Ember', 'Garnet', 'Wine', 'Cherry', 'Brick', 'Cinder'],
    mid: ['Paprika', 'Poppy', 'Chili', 'Rouge', 'Clay', 'Flame'],
    light: ['Petal', 'Shell', 'Coral', 'Salmon', 'Rosewater', 'Blossom'],
  },
  orange: {
    dark: ['Rust', 'Copper', 'Cedar', 'Ginger', 'Brandy', 'Clove'],
    mid: ['Terracotta', 'Persimmon', 'Marigold', 'Tangerine', 'Carrot', 'Spice'],
    light: ['Peach', 'Apricot', 'Melon', 'Sherbet', 'Papaya', 'Creamsicle'],
  },
  amber: {
    dark: ['Whiskey', 'Tobacco', 'Bronze', 'Walnut', 'Toffee', 'Umber'],
    mid: ['Amber', 'Caramel', 'Ochre', 'Maple', 'Cider', 'Fawn'],
    light: ['Honey', 'Wheat', 'Sand', 'Flax', 'Biscuit', 'Cream'],
  },
  yellow: {
    dark: ['Dijon', 'Brass', 'Curry', 'Olive', 'Bronze', 'Marsh'],
    mid: ['Mustard', 'Saffron', 'Gold', 'Corn', 'Sunflower', 'Lemon'],
    light: ['Butter', 'Straw', 'Custard', 'Daffodil', 'Vanilla', 'Parchment'],
  },
  lime: {
    dark: ['Olive', 'Fern', 'Moss', 'Pickle', 'Cactus', 'Ivy'],
    mid: ['Pear', 'Sprig', 'Lime', 'Apple', 'Palm', 'Leaf'],
    light: ['Sprout', 'Pistachio', 'Mint', 'Honeydew', 'Celery', 'Fennel'],
  },
  green: {
    dark: ['Juniper', 'Forest', 'Kelp', 'Pine', 'Spruce', 'Hunter'],
    mid: ['Moss', 'Matcha', 'Jade', 'Basil', 'Clover', 'Emerald'],
    light: ['Celadon', 'Mist', 'Sage', 'Seafoam', 'Dew', 'Willow'],
  },
  teal: {
    dark: ['Pine', 'Malachite', 'Spruce', 'Marine', 'Juniper', 'Kelp'],
    mid: ['Teal', 'Lagoon', 'Jade', 'Marina', 'Peacock', 'Tide'],
    light: ['Aqua', 'Spearmint', 'Surf', 'Foam', 'Opal', 'Mist'],
  },
  cyanBlue: {
    dark: ['Fathom', 'Abyss', 'Ink', 'Storm', 'Depth', 'Petrol'],
    mid: ['Harbor', 'Cerulean', 'Slate', 'Marine', 'Wave', 'Steel'],
    light: ['Powder', 'Glacier', 'Sky', 'Frost', 'Cloud', 'Ice'],
  },
  blue: {
    dark: ['Midnight', 'Ink', 'Navy', 'Sapphire', 'Indigo', 'Nightfall'],
    mid: ['Denim', 'Delft', 'Cobalt', 'Ocean', 'Marine', 'Lapis'],
    light: ['Dawn', 'Periwinkle', 'Chicory', 'Bluebell', 'Fog', 'Robin'],
  },
  violet: {
    dark: ['Eclipse', 'Nightshade', 'Damson', 'Ink', 'Raisin', 'Dusk'],
    mid: ['Iris', 'Wisteria', 'Violet', 'Pansy', 'Amethyst', 'Bloom'],
    light: ['Lilac', 'Lavender', 'Haze', 'Mauve', 'Mist', 'Sweetpea'],
  },
  purple: {
    dark: ['Aubergine', 'Plum', 'Mulberry', 'Fig', 'Raisin', 'Cassis'],
    mid: ['Orchid', 'Amethyst', 'Grape', 'Magenta', 'Dahlia', 'Fuchsia'],
    light: ['Heather', 'Thistle', 'Mauve', 'Lilac', 'Petal', 'Pearl'],
  },
  pink: {
    dark: ['Garnet', 'Berry', 'Sangria', 'Raspberry', 'Currant', 'Beet'],
    mid: ['Rose', 'Peony', 'Guava', 'Punch', 'Flamingo', 'Taffy'],
    light: ['Blush', 'Bellini', 'Ballet', 'Rosebud', 'Cameo', 'Sorbet'],
  },
  neutral: {
    dark: ['Charcoal', 'Basalt', 'Soot', 'Graphite', 'Shadow', 'Slate'],
    mid: ['Clay', 'Pumice', 'Loam', 'Stone', 'Taupe', 'Driftwood'],
    light: ['Bone', 'Oat', 'Chalk', 'Ivory', 'Fog', 'Linen'],
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
// botanicals, textures — short concrete nouns that carry a color without
// describing one.
export const PLACE_THINGS: PlaceThing[] = [
  // Places
  { word: 'Amalfi', families: ['yellow', 'orange', 'blue'] },
  { word: 'Kyoto', families: ['pink', 'green'] },
  { word: 'Tangier', families: ['amber', 'orange'] },
  { word: 'Marrakesh', families: ['red', 'orange', 'amber'] },
  { word: 'Harbor', families: ['cyanBlue', 'blue', 'neutral'] },
  { word: 'Market', moods: ['vivid'] },
  { word: 'Garden' },
  { word: 'Porch' },
  { word: 'Studio' },
  { word: 'Atlas' },
  { word: 'Postcard' },
  { word: 'Sonnet' },
  // Time of day
  { word: 'Dawn', moods: ['soft'] },
  { word: 'Dusk', families: ['violet', 'purple', 'blue', 'neutral'] },
  { word: 'Noon', families: ['yellow', 'amber'], moods: ['vivid'] },
  { word: 'Twilight', families: ['violet', 'blue', 'purple'] },
  { word: 'Solstice' },
  { word: 'Sunday', moods: ['soft', 'muted'] },
  { word: 'Hour' },
  // Weather
  { word: 'Drizzle', families: ['neutral', 'cyanBlue', 'green'], moods: ['muted'] },
  { word: 'Fog', families: ['neutral', 'cyanBlue'], moods: ['muted'] },
  { word: 'Breeze', moods: ['soft'] },
  { word: 'Squall', families: ['cyanBlue', 'blue', 'neutral'], moods: ['vivid'] },
  { word: 'Monsoon', families: ['teal', 'green', 'blue'] },
  { word: 'Thaw', moods: ['soft', 'muted'] },
  { word: 'Storm', moods: ['vivid', 'muted'] },
  { word: 'Rain', moods: ['muted', 'soft'] },
  // Landscape
  { word: 'Moor', families: ['green', 'purple', 'neutral'], moods: ['muted'] },
  { word: 'Fjord', families: ['teal', 'cyanBlue', 'blue'] },
  { word: 'Dune', families: ['amber', 'yellow', 'neutral'] },
  { word: 'Heath', families: ['green', 'purple', 'lime'] },
  { word: 'Orchard', families: ['green', 'lime', 'red'] },
  { word: 'Grove', families: ['green', 'lime'] },
  { word: 'Cove', families: ['teal', 'cyanBlue', 'blue'] },
  { word: 'Reef', families: ['teal', 'cyanBlue'], moods: ['vivid'] },
  { word: 'Shore', families: ['blue', 'teal', 'neutral'] },
  { word: 'Field', families: ['green', 'lime', 'yellow'] },
  { word: 'Creek', families: ['teal', 'green', 'neutral'] },
  { word: 'Cliff', families: ['neutral', 'amber'] },
  { word: 'Sunset', families: ['red', 'orange', 'pink'] },
  { word: 'Prairie', families: ['amber', 'yellow', 'lime'] },
  { word: 'Bayou', families: ['green', 'teal'], moods: ['muted'] },
  { word: 'Valley' },
  { word: 'Trail' },
  // Botanical
  { word: 'Yarrow', families: ['yellow', 'lime'] },
  { word: 'Sorrel', families: ['green', 'lime', 'red'] },
  { word: 'Clover', families: ['green', 'lime', 'pink'] },
  { word: 'Willow', families: ['green', 'lime', 'neutral'], moods: ['soft', 'muted'] },
  { word: 'Poppy', families: ['red', 'orange'], moods: ['vivid'] },
  { word: 'Bramble', families: ['purple', 'pink', 'green'], moods: ['muted'] },
  { word: 'Petal', moods: ['soft'] },
  // Texture / material
  { word: 'Velvet', moods: ['vivid', 'soft'] },
  { word: 'Linen', moods: ['muted', 'soft'] },
  { word: 'Silk', moods: ['soft'] },
  { word: 'Glass' },
  { word: 'Patina', families: ['teal', 'green', 'neutral'], moods: ['muted'] },
  { word: 'Smoke', families: ['neutral'], moods: ['muted'] },
  { word: 'Chalk', families: ['neutral'], moods: ['muted', 'soft'] },
]

// Modifiers keyed by mood — experiential and textural adjectives (how a
// palette feels, weathers, or catches light), not color words. Short and
// plain: words someone would actually put in front of a paint name.
export const MODIFIERS: Record<Mood, string[]> = {
  muted: ['Quiet', 'Faded', 'Dusty', 'Worn', 'Pale', 'Still', 'Smoky', 'Soft', 'Ashen', 'Misty', 'Dim', 'Cool'],
  soft: ['Morning', 'Tender', 'Mellow', 'Milky', 'Hazy', 'Drowsy', 'Gentle', 'Warm', 'Sleepy', 'Calm', 'Light'],
  vivid: ['Electric', 'Loud', 'Bold', 'Bright', 'Wild', 'Ripe', 'Burning', 'Neon', 'Hot', 'Molten', 'Fresh'],
}
