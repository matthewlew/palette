export type HueFamily =
  | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green'
  | 'teal' | 'cyanBlue' | 'blue' | 'violet' | 'purple' | 'pink' | 'neutral'

export type LightnessBand = 'dark' | 'mid' | 'light'
export type Mood = 'muted' | 'soft' | 'vivid'

// Color nouns keyed by [family][band]. Single short words people actually
// write — paint-chip register, not perfume copy.
//
// Twelve per band, not six. Six was the original budget and it showed: a
// gallery of twenty saves would surface "Terracotta" or "Slate" three or four
// times, because every mid-orange palette draws from the same six-word bag.
// Doubling the bag halves the collision rate on its own, and it multiplies
// against the reference pool below.
export const COLOR_NOUNS: Record<HueFamily, Record<LightnessBand, string[]>> = {
  red: {
    dark: ['Ember', 'Garnet', 'Wine', 'Cherry', 'Brick', 'Cinder', 'Oxblood', 'Merlot', 'Madder', 'Carmine', 'Ruby', 'Bordeaux'],
    mid: ['Paprika', 'Poppy', 'Chili', 'Rouge', 'Clay', 'Flame', 'Scarlet', 'Cinnabar', 'Vermilion', 'Tomato', 'Lacquer', 'Sumac'],
    light: ['Petal', 'Shell', 'Coral', 'Salmon', 'Rosewater', 'Blossom', 'Camellia', 'Watermelon', 'Quartz', 'Conch', 'Grapefruit', 'Peppermint'],
  },
  orange: {
    dark: ['Rust', 'Copper', 'Cedar', 'Ginger', 'Brandy', 'Clove', 'Chestnut', 'Henna', 'Sienna', 'Tamarind', 'Roan', 'Chutney'],
    mid: ['Terracotta', 'Persimmon', 'Marigold', 'Tangerine', 'Carrot', 'Spice', 'Kumquat', 'Turmeric', 'Achiote', 'Harvest', 'Nasturtium', 'Mandarin'],
    light: ['Peach', 'Apricot', 'Melon', 'Sherbet', 'Papaya', 'Creamsicle', 'Nectarine', 'Cantaloupe', 'Guava', 'Sunrise', 'Marzipan', 'Loquat'],
  },
  amber: {
    dark: ['Whiskey', 'Tobacco', 'Bronze', 'Walnut', 'Toffee', 'Umber', 'Molasses', 'Chicory', 'Espresso', 'Pecan', 'Mahogany', 'Treacle'],
    mid: ['Amber', 'Caramel', 'Ochre', 'Maple', 'Cider', 'Fawn', 'Honeycomb', 'Butterscotch', 'Topaz', 'Praline', 'Bourbon', 'Marmalade'],
    light: ['Honey', 'Wheat', 'Sand', 'Flax', 'Biscuit', 'Cream', 'Shortbread', 'Champagne', 'Almond', 'Barley', 'Meringue', 'Tallow'],
  },
  yellow: {
    dark: ['Dijon', 'Brass', 'Curry', 'Olive', 'Marsh', 'Fenugreek', 'Cumin', 'Loess', 'Tarnish', 'Bittern', 'Antimony', 'Bracken'],
    mid: ['Mustard', 'Saffron', 'Gold', 'Corn', 'Sunflower', 'Lemon', 'Piccalilli', 'Calendula', 'Beeswax', 'Pollen', 'Quince', 'Egg'],
    light: ['Butter', 'Straw', 'Custard', 'Daffodil', 'Vanilla', 'Parchment', 'Semolina', 'Chamomile', 'Lemonade', 'Buttermilk', 'Primrose', 'Cornsilk'],
  },
  lime: {
    dark: ['Fern', 'Moss', 'Pickle', 'Cactus', 'Ivy', 'Bracken', 'Wasabi', 'Absinthe', 'Thyme', 'Nettle', 'Bayleaf', 'Wormwood'],
    mid: ['Pear', 'Sprig', 'Lime', 'Apple', 'Palm', 'Leaf', 'Verdigris', 'Shiso', 'Tendril', 'Chartreuse', 'Rind', 'Kaffir'],
    light: ['Sprout', 'Pistachio', 'Mint', 'Honeydew', 'Celery', 'Fennel', 'Lettuce', 'Wintergreen', 'Yuzu', 'Linden', 'Verbena', 'Kiwi'],
  },
  green: {
    dark: ['Juniper', 'Forest', 'Kelp', 'Pine', 'Spruce', 'Hunter', 'Cypress', 'Laurel', 'Myrtle', 'Malachite', 'Viridian', 'Boxwood'],
    mid: ['Moss', 'Matcha', 'Jade', 'Basil', 'Clover', 'Emerald', 'Eucalyptus', 'Tarragon', 'Serpentine', 'Bamboo', 'Shamrock', 'Peridot'],
    light: ['Celadon', 'Mist', 'Sage', 'Seafoam', 'Dew', 'Willow', 'Aloe', 'Cucumber', 'Meadow', 'Lichen', 'Eelgrass', 'Pale'],
  },
  teal: {
    dark: ['Malachite', 'Spruce', 'Marine', 'Juniper', 'Kelp', 'Petrol', 'Fathom', 'Tarn', 'Loch', 'Cypress', 'Verdigris', 'Undertow'],
    mid: ['Teal', 'Lagoon', 'Jade', 'Marina', 'Peacock', 'Tide', 'Turquoise', 'Kingfisher', 'Oasis', 'Reef', 'Larimar', 'Celadon'],
    light: ['Aqua', 'Spearmint', 'Surf', 'Foam', 'Opal', 'Mist', 'Seaglass', 'Shallows', 'Aquamarine', 'Breaker', 'Tidepool', 'Rime'],
  },
  cyanBlue: {
    dark: ['Fathom', 'Abyss', 'Ink', 'Storm', 'Depth', 'Petrol', 'Trench', 'Anchor', 'Gunmetal', 'Nautical', 'Pitchblende', 'Keel'],
    mid: ['Harbor', 'Cerulean', 'Slate', 'Marine', 'Wave', 'Steel', 'Azure', 'Chambray', 'Cyan', 'Riptide', 'Signal', 'Spindrift'],
    light: ['Powder', 'Glacier', 'Sky', 'Frost', 'Cloud', 'Ice', 'Cornflower', 'Porcelain', 'Vapor', 'Horizon', 'Baltic', 'Cirrus'],
  },
  blue: {
    dark: ['Midnight', 'Ink', 'Navy', 'Sapphire', 'Indigo', 'Nightfall', 'Prussian', 'Admiral', 'Obsidian', 'Meridian', 'Woad', 'Vespers'],
    mid: ['Denim', 'Delft', 'Cobalt', 'Ocean', 'Marine', 'Lapis', 'Ultramarine', 'Klein', 'Sailor', 'Bluebonnet', 'Cyanotype', 'Chicory'],
    light: ['Dawn', 'Periwinkle', 'Bluebell', 'Fog', 'Robin', 'Hydrangea', 'Wedgwood', 'Moonstone', 'Harebell', 'Plumbago', 'Bunting', 'Rain'],
  },
  violet: {
    dark: ['Eclipse', 'Nightshade', 'Damson', 'Ink', 'Raisin', 'Dusk', 'Blackberry', 'Byzantium', 'Tyrian', 'Umbra', 'Vespers', 'Sloe'],
    mid: ['Iris', 'Wisteria', 'Violet', 'Pansy', 'Amethyst', 'Bloom', 'Lavandin', 'Campanula', 'Clematis', 'Gentian', 'Ultraviolet', 'Larkspur'],
    light: ['Lilac', 'Lavender', 'Haze', 'Mauve', 'Sweetpea', 'Hyacinth', 'Freesia', 'Opaline', 'Chiffon', 'Wisteria', 'Aster', 'Veil'],
  },
  purple: {
    dark: ['Aubergine', 'Plum', 'Mulberry', 'Fig', 'Raisin', 'Cassis', 'Boysenberry', 'Elderberry', 'Tyrian', 'Sloe', 'Port', 'Damson'],
    mid: ['Orchid', 'Amethyst', 'Grape', 'Magenta', 'Dahlia', 'Fuchsia', 'Hibiscus', 'Bougainvillea', 'Mallow', 'Jacaranda', 'Cyclamen', 'Loganberry'],
    light: ['Heather', 'Thistle', 'Mauve', 'Lilac', 'Petal', 'Pearl', 'Foxglove', 'Sugarplum', 'Chiffon', 'Opaline', 'Wisteria', 'Fondant'],
  },
  pink: {
    dark: ['Garnet', 'Berry', 'Sangria', 'Raspberry', 'Currant', 'Beet', 'Pomegranate', 'Claret', 'Rhubarb', 'Cranberry', 'Bordeaux', 'Sorrel'],
    mid: ['Rose', 'Peony', 'Guava', 'Punch', 'Flamingo', 'Taffy', 'Watermelon', 'Camellia', 'Azalea', 'Bubblegum', 'Carnation', 'Lychee'],
    light: ['Blush', 'Bellini', 'Ballet', 'Rosebud', 'Cameo', 'Sorbet', 'Seashell', 'Marshmallow', 'Chiffon', 'Fondant', 'Powderpuff', 'Icing'],
  },
  neutral: {
    dark: ['Charcoal', 'Basalt', 'Soot', 'Graphite', 'Shadow', 'Slate', 'Obsidian', 'Pitch', 'Onyx', 'Anthracite', 'Ironstone', 'Gunmetal'],
    mid: ['Clay', 'Pumice', 'Loam', 'Stone', 'Taupe', 'Driftwood', 'Cement', 'Ash', 'Flannel', 'Putty', 'Sandstone', 'Mushroom'],
    light: ['Bone', 'Oat', 'Chalk', 'Ivory', 'Fog', 'Linen', 'Eggshell', 'Alabaster', 'Muslin', 'Greige', 'Porcelain', 'Bisque'],
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

/**
 * Cultural references: the head noun that makes a name feel authored rather
 * than assembled. Drawn from myth, folklore, verse forms, music, festivals,
 * night-sky names and the untranslatable mood-words a lot of languages have
 * and English doesn't — deliberately not centred on any one tradition.
 *
 * Three rules the list holds to, because breaking any of them shows up
 * immediately in a gallery:
 *
 * 1. ONE TOKEN. The templates cap a name at three words, so a two-word
 *    reference ("Mono no aware", "Baba Yaga") would silently break the cap or
 *    get filtered out and waste a slot. Hyphenated counts as one.
 * 2. PLAIN ASCII. These get slugified into share URLs and filenames
 *    (see BoardShare / canvasExport), so diacritics are folded here rather
 *    than mangled downstream — Huzun, Mangata, Danzon.
 * 3. NOT SOMEONE'S TRADEMARK. Public-domain and traditional sources only.
 *    Named worlds from in-copyright franchises are exactly the kind of thing a
 *    publicly-listed app should not be minting names from.
 *
 * Affinities stay sparse on purpose: most of these carry a mood rather than a
 * hue, and over-tagging them collapses the very pool that fixes the repetition.
 */
export const REFERENCES: PlaceThing[] = [
  // ── Literary and mythic places (public domain) ────────────────────────
  { word: 'Xanadu', moods: ['vivid'] },
  { word: 'Ithaca' },
  { word: 'Elsinore', families: ['neutral', 'cyanBlue'], moods: ['muted'] },
  { word: 'Avalon', families: ['green', 'teal'], moods: ['muted'] },
  { word: 'Camelot' },
  { word: 'Arcadia', families: ['green', 'lime'], moods: ['soft'] },
  { word: 'Byzantium', families: ['purple', 'amber'], moods: ['vivid'] },
  { word: 'Innisfree', families: ['green', 'teal'], moods: ['soft', 'muted'] },
  { word: 'Utopia' },
  { word: 'Erewhon' },
  { word: 'Lilliput' },
  { word: 'Laputa', families: ['cyanBlue', 'blue'] },
  { word: 'Eldorado', families: ['amber', 'yellow'], moods: ['vivid'] },
  { word: 'Cathay' },
  { word: 'Samarkand', families: ['teal', 'blue', 'amber'] },
  { word: 'Timbuktu', families: ['amber', 'orange'] },
  { word: 'Zanzibar', families: ['teal', 'cyanBlue'] },
  { word: 'Alexandria' },
  { word: 'Persepolis', families: ['amber', 'orange', 'red'] },
  { word: 'Palmyra', families: ['amber', 'neutral'] },
  { word: 'Carthage', families: ['red', 'amber'] },
  { word: 'Isfahan', families: ['teal', 'blue'] },
  { word: 'Bukhara', families: ['amber', 'teal'] },
  { word: 'Kashgar' },
  { word: 'Lhasa', families: ['red', 'amber', 'blue'] },
  { word: 'Petra', families: ['orange', 'amber', 'neutral'] },
  { word: 'Sheba', families: ['amber', 'purple'] },
  { word: 'Ophir', families: ['amber', 'yellow'] },
  { word: 'Thule', families: ['cyanBlue', 'neutral'], moods: ['muted'] },
  { word: 'Lyonesse', families: ['teal', 'green'], moods: ['muted'] },
  { word: 'Tintagel', families: ['neutral', 'cyanBlue'], moods: ['muted'] },
  { word: 'Hesperides', families: ['yellow', 'amber', 'lime'] },
  { word: 'Elysium', moods: ['soft'] },
  { word: 'Macondo', families: ['green', 'yellow'], moods: ['vivid'] },
  { word: 'Comala', families: ['neutral', 'amber'], moods: ['muted'] },
  { word: 'Brigadoon', families: ['green', 'neutral'], moods: ['muted'] },
  { word: 'Serengeti', families: ['amber', 'yellow', 'orange'] },
  { word: 'Sundarbans', families: ['green', 'teal'], moods: ['muted'] },
  { word: 'Deccan', families: ['amber', 'neutral'] },
  { word: 'Malabar', families: ['green', 'teal'] },

  // ── Myth and folklore, several traditions ─────────────────────────────
  { word: 'Amaterasu', families: ['yellow', 'amber', 'orange'], moods: ['vivid'] },
  { word: 'Izanami', families: ['violet', 'blue'], moods: ['muted'] },
  { word: 'Anansi' },
  { word: 'Yemoja', families: ['blue', 'teal', 'cyanBlue'] },
  { word: 'Oshun', families: ['amber', 'yellow'], moods: ['vivid'] },
  { word: 'Shango', families: ['red', 'orange'], moods: ['vivid'] },
  { word: 'Obatala', families: ['neutral'], moods: ['soft'] },
  { word: 'Quetzal', families: ['green', 'teal'], moods: ['vivid'] },
  { word: 'Xibalba', families: ['neutral', 'violet'], moods: ['muted'] },
  { word: 'Itzamna' },
  { word: 'Inti', families: ['yellow', 'amber'], moods: ['vivid'] },
  { word: 'Hathor', families: ['amber', 'pink'] },
  { word: 'Bastet', families: ['amber', 'neutral'] },
  { word: 'Anubis', families: ['neutral'], moods: ['muted'] },
  { word: 'Osiris', families: ['green', 'teal'] },
  { word: 'Selene', families: ['neutral', 'blue'], moods: ['soft'] },
  { word: 'Helios', families: ['yellow', 'amber'], moods: ['vivid'] },
  { word: 'Nyx', families: ['blue', 'violet'], moods: ['muted'] },
  { word: 'Erebus', families: ['neutral', 'violet'], moods: ['muted'] },
  { word: 'Aurora', moods: ['vivid'] },
  { word: 'Freya', families: ['pink', 'amber'] },
  { word: 'Skadi', families: ['cyanBlue', 'neutral'], moods: ['muted'] },
  { word: 'Yggdrasil', families: ['green', 'lime'] },
  { word: 'Rusalka', families: ['teal', 'green'], moods: ['muted'] },
  { word: 'Firebird', families: ['red', 'orange', 'amber'], moods: ['vivid'] },
  { word: 'Garuda', families: ['amber', 'orange'], moods: ['vivid'] },
  { word: 'Apsara', families: ['pink', 'amber'], moods: ['soft'] },
  { word: 'Rangi', families: ['blue', 'cyanBlue'] },
  { word: 'Selkie', families: ['neutral', 'cyanBlue'], moods: ['muted'] },
  { word: 'Kelpie', families: ['teal', 'neutral'], moods: ['muted'] },
  { word: 'Annwn', families: ['violet', 'neutral'], moods: ['muted'] },
  { word: 'Rhiannon', families: ['neutral', 'violet'], moods: ['soft'] },
  { word: 'Thunderbird', moods: ['vivid'] },
  { word: 'Songline', families: ['orange', 'red', 'amber'] },
  { word: 'Bunyip', families: ['green', 'neutral'], moods: ['muted'] },

  // ── Words other languages have for a feeling ──────────────────────────
  { word: 'Saudade', moods: ['muted', 'soft'] },
  { word: 'Hiraeth', moods: ['muted'] },
  { word: 'Duende', moods: ['vivid'] },
  { word: 'Sobremesa', moods: ['soft'] },
  { word: 'Komorebi', families: ['green', 'lime', 'yellow'], moods: ['soft'] },
  { word: 'Kintsugi', families: ['amber', 'yellow', 'neutral'] },
  { word: 'Ukiyo' },
  { word: 'Wabi', moods: ['muted'] },
  { word: 'Sabi', moods: ['muted'] },
  { word: 'Yugen', moods: ['muted', 'soft'] },
  { word: 'Hanami', families: ['pink'], moods: ['soft'] },
  { word: 'Tsukimi', families: ['neutral', 'blue'], moods: ['soft'] },
  { word: 'Momiji', families: ['red', 'orange', 'amber'] },
  { word: 'Hygge', moods: ['soft'] },
  { word: 'Lagom', moods: ['muted'] },
  { word: 'Gezellig', moods: ['soft'] },
  { word: 'Sisu', moods: ['vivid'] },
  { word: 'Fika', moods: ['soft'] },
  { word: 'Mangata', families: ['blue', 'cyanBlue', 'neutral'], moods: ['soft'] },
  { word: 'Meraki', moods: ['vivid'] },
  { word: 'Philotimo' },
  { word: 'Toska', moods: ['muted'] },
  { word: 'Ubuntu' },
  { word: 'Harambee', moods: ['vivid'] },
  { word: 'Sankofa' },
  { word: 'Jugaad', moods: ['vivid'] },
  { word: 'Sukoon', moods: ['soft', 'muted'] },
  { word: 'Tarab', moods: ['vivid'] },
  { word: 'Ishq', families: ['red', 'pink'], moods: ['vivid'] },
  { word: 'Keyif', moods: ['soft'] },
  { word: 'Huzun', moods: ['muted'] },
  { word: 'Querencia', moods: ['soft', 'muted'] },
  { word: 'Cafune', moods: ['soft'] },
  { word: 'Ganas', moods: ['vivid'] },
  { word: 'Sereno', moods: ['soft', 'muted'] },
  { word: 'Harmattan', families: ['amber', 'yellow', 'neutral'], moods: ['muted'] },

  // ── Verse forms and the shape of a poem ───────────────────────────────
  { word: 'Ghazal' },
  { word: 'Haiku', moods: ['muted', 'soft'] },
  { word: 'Tanka', moods: ['soft'] },
  { word: 'Villanelle' },
  { word: 'Aubade', families: ['pink', 'amber'], moods: ['soft'] },
  { word: 'Nocturne', families: ['blue', 'violet', 'neutral'], moods: ['muted'] },
  { word: 'Sestina' },
  { word: 'Canto' },
  { word: 'Refrain' },
  { word: 'Stanza' },
  { word: 'Rubaiyat', families: ['amber', 'purple'] },
  { word: 'Elegy', moods: ['muted'] },
  { word: 'Ode', moods: ['vivid'] },
  { word: 'Psalm', moods: ['soft'] },
  { word: 'Ballad' },
  { word: 'Madrigal', moods: ['soft'] },
  { word: 'Lullaby', moods: ['soft'] },
  { word: 'Reverie', moods: ['soft', 'muted'] },
  { word: 'Preface' },
  { word: 'Epilogue', moods: ['muted'] },
  { word: 'Marginalia', moods: ['muted'] },

  // ── Music: forms, traditions, instruments ─────────────────────────────
  { word: 'Raga', families: ['amber', 'orange'] },
  { word: 'Qawwali', moods: ['vivid'] },
  { word: 'Fado', moods: ['muted'] },
  { word: 'Bolero', families: ['red'], moods: ['vivid'] },
  { word: 'Samba', moods: ['vivid'] },
  { word: 'Cumbia', moods: ['vivid'] },
  { word: 'Danzon' },
  { word: 'Highlife', moods: ['vivid'] },
  { word: 'Kora' },
  { word: 'Griot' },
  { word: 'Kalimba' },
  { word: 'Gamelan', families: ['amber', 'teal'] },
  { word: 'Guzheng' },
  { word: 'Shamisen' },
  { word: 'Sitar', families: ['amber', 'orange'] },
  { word: 'Tabla' },
  { word: 'Bandoneon', moods: ['muted'] },
  { word: 'Nocturnes', moods: ['muted'] },
  { word: 'Prelude', moods: ['soft'] },
  { word: 'Cadenza', moods: ['vivid'] },
  { word: 'Serenade', moods: ['soft'] },
  { word: 'Chorale', moods: ['soft'] },
  { word: 'Etude' },
  { word: 'Fugue', families: ['neutral', 'blue'], moods: ['muted'] },
  { word: 'Bossa', moods: ['soft'] },

  // ── Festivals and turnings of the year ────────────────────────────────
  { word: 'Diwali', families: ['amber', 'orange', 'yellow'], moods: ['vivid'] },
  { word: 'Holi', moods: ['vivid'] },
  { word: 'Nowruz', families: ['green', 'lime'], moods: ['vivid'] },
  { word: 'Obon', families: ['amber', 'red'] },
  { word: 'Chuseok', families: ['amber', 'yellow'] },
  { word: 'Songkran', families: ['cyanBlue', 'teal'], moods: ['vivid'] },
  { word: 'Losar' },
  { word: 'Vesak', families: ['amber', 'yellow'], moods: ['soft'] },
  { word: 'Beltane', families: ['red', 'green'], moods: ['vivid'] },
  { word: 'Samhain', families: ['orange', 'neutral'], moods: ['muted'] },
  { word: 'Imbolc', families: ['neutral', 'lime'], moods: ['muted'] },
  { word: 'Yule', families: ['green', 'red'], moods: ['muted'] },
  { word: 'Carnaval', moods: ['vivid'] },
  { word: 'Junkanoo', moods: ['vivid'] },
  { word: 'Qingming', families: ['green', 'lime'], moods: ['muted'] },
  { word: 'Tanabata', families: ['blue', 'violet'] },
  { word: 'Pongal', families: ['yellow', 'amber'] },
  { word: 'Onam', families: ['green', 'yellow'], moods: ['vivid'] },

  // ── Night sky ─────────────────────────────────────────────────────────
  { word: 'Orion', families: ['blue', 'neutral'] },
  { word: 'Lyra' },
  { word: 'Vega', families: ['cyanBlue', 'blue'] },
  { word: 'Altair' },
  { word: 'Andromeda', families: ['violet', 'blue'] },
  { word: 'Pleiades', families: ['blue', 'cyanBlue'], moods: ['soft'] },
  { word: 'Perseid', moods: ['vivid'] },
  { word: 'Cassiopeia' },
  { word: 'Polaris', families: ['cyanBlue', 'neutral'] },
  { word: 'Antares', families: ['red', 'orange'], moods: ['vivid'] },
  { word: 'Sirius', families: ['cyanBlue', 'blue'], moods: ['vivid'] },
  { word: 'Cygnus' },
  { word: 'Zenith' },
  { word: 'Meridian' },
  { word: 'Ecliptic' },
  { word: 'Penumbra', families: ['neutral', 'violet'], moods: ['muted'] },

  // ── Ways of looking, and things that hold an image ────────────────────
  { word: 'Zoetrope' },
  { word: 'Kaleidoscope', moods: ['vivid'] },
  { word: 'Diorama' },
  { word: 'Panorama' },
  { word: 'Matinee', moods: ['soft', 'muted'] },
  { word: 'Cassette', moods: ['muted'] },
  { word: 'Vinyl' },
  { word: 'Jukebox', moods: ['vivid'] },
  { word: 'Daguerreotype', families: ['neutral', 'amber'], moods: ['muted'] },
  { word: 'Cyanotype', families: ['blue', 'cyanBlue'] },
  { word: 'Woodblock', families: ['blue', 'red'] },
  { word: 'Fresco', moods: ['muted'] },
  { word: 'Mosaic', moods: ['vivid'] },
  { word: 'Batik', moods: ['vivid'] },
  { word: 'Ikat', moods: ['vivid'] },
  { word: 'Sashiko', families: ['blue', 'cyanBlue'] },
  { word: 'Kente', moods: ['vivid'] },
  { word: 'Adire', families: ['blue', 'cyanBlue'] },
  { word: 'Boro', families: ['blue', 'neutral'], moods: ['muted'] },
  { word: 'Talavera', families: ['blue', 'yellow'], moods: ['vivid'] },
  { word: 'Azulejo', families: ['blue', 'cyanBlue'] },
  { word: 'Zellige', families: ['teal', 'green'] },
]

// Modifiers keyed by mood — experiential and textural adjectives (how a
// palette feels, weathers, or catches light), not color words. Short and
// plain: words someone would actually put in front of a paint name.
export const MODIFIERS: Record<Mood, string[]> = {
  muted: [
    'Quiet', 'Faded', 'Dusty', 'Worn', 'Pale', 'Still', 'Smoky', 'Soft', 'Ashen',
    'Misty', 'Dim', 'Cool', 'Washed', 'Shadowed', 'Subtle', 'Weathered', 'Antique',
    'Sepia', 'Overcast', 'Hushed', 'Distant', 'Sunfaded', 'Salted', 'Chalky',
    'Wintered', 'Muffled', 'Threadbare', 'Slow', 'Clouded', 'Tarnished',
  ],
  soft: [
    'Morning', 'Tender', 'Mellow', 'Milky', 'Hazy', 'Drowsy', 'Gentle', 'Warm',
    'Sleepy', 'Calm', 'Light', 'Dreamy', 'Velvety', 'Powdered', 'Feathered',
    'Gossamer', 'Downy', 'Balmy', 'Sunwashed', 'Wistful', 'Lilting', 'Halcyon',
    'Languid', 'Dawnlit', 'Moonlit', 'Cradled', 'Blushing', 'Unhurried',
    'Petalled', 'Lulled',
  ],
  vivid: [
    'Electric', 'Loud', 'Bold', 'Bright', 'Wild', 'Ripe', 'Burning', 'Neon', 'Hot',
    'Molten', 'Fresh', 'Vibrant', 'Striking', 'Luminous', 'Radiant', 'Intense',
    'Blazing', 'Fierce', 'Saturated', 'Roaring', 'Feverish', 'Kinetic', 'Voltaic',
    'Incandescent', 'Torched', 'Flaring', 'Riotous', 'Prismatic', 'Jubilant', 'Rampant',
  ],
}
