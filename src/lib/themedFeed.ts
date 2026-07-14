import type { Gradient } from '../store/types'

export interface Theme {
  id: string
  name: string
  subtitle: string
  description: string
  emoji: string
  themeColor: string
  gradients: Gradient[]
}

export const THEMED_FEEDS: Theme[] = [
  {
    id: 'banff',
    name: 'Banff National Park',
    subtitle: 'Glacier turquoise & alpine pine needles',
    description: 'A quiet escape into the Canadian Rockies. Inspired by the towering limestone peaks, freezing meltwater, and shifting alpenglow over the Vermilion Lakes.',
    emoji: '🏔️',
    themeColor: '#76c2b4',
    gradients: [
      {
        id: 'themed-banff-moraine',
        name: 'Moraine Turquoise',
        type: 'linear',
        note: 'The striking, milky turquoise of glacier lakes under late morning sunlight.',
        stops: [
          { hex: '#005e6b', position: 0, label: 'Glacier Deep' },
          { hex: '#0a8f9f', position: 50, label: 'Moraine Turquoise' },
          { hex: '#e3ecec', position: 100, label: 'Rock Flour Mist' }
        ]
      },
      {
        id: 'themed-banff-pine',
        name: 'Pine Shadow',
        type: 'linear',
        note: 'Looking up through the dense spruce canopy along the Valley of the Ten Peaks.',
        stops: [
          { hex: '#142b1f', position: 0, label: 'Deep Forest Shade' },
          { hex: '#375240', position: 60, label: 'Alpine Spruce' },
          { hex: '#b3c4b8', position: 100, label: 'Mountain Sage' }
        ]
      },
      {
        id: 'themed-banff-sunset',
        name: 'Vermilion Dusk',
        type: 'linear',
        note: 'Alpenglow casting warm tones onto the peak face while the lakes below sink into cold indigo shadows.',
        stops: [
          { hex: '#1b1b36', position: 0, label: 'Indigo Lake Shadow' },
          { hex: '#bf5d39', position: 65, label: 'Alpenglow Peach' },
          { hex: '#f0c784', position: 100, label: 'Sulphur Gold' }
        ]
      }
    ]
  },
  {
    id: 'tarot',
    name: 'Tarot & Cosmic Voids',
    subtitle: 'Astronomical fate & celestial indigo',
    description: 'A descent into starlight and mystery. Inspired by the Major Arcana cards, cosmic geometry, and the deep obsidian voids of outer space.',
    emoji: '🃏',
    themeColor: '#a88beb',
    gradients: [
      {
        id: 'themed-tarot-star',
        name: 'The Star',
        type: 'radial',
        note: 'Hope, light, and inspiration emerging from a deep celestial sky.',
        stops: [
          { hex: '#ffd54f', position: 0, label: 'The Central Star' },
          { hex: '#311b92', position: 50, label: 'Cosmic Sky' },
          { hex: '#0a0033', position: 100, label: 'Astrological Void' }
        ]
      },
      {
        id: 'themed-tarot-priestess',
        name: 'High Priestess',
        type: 'linear',
        note: 'The silver moon and royal purple vestments of intuitive, hidden knowledge.',
        stops: [
          { hex: '#1f132e', position: 0, label: 'Hidden Secret' },
          { hex: '#6b3f9c', position: 60, label: 'Priestess Vestment' },
          { hex: '#e8e6ed', position: 100, label: 'Silver Crescent Moon' }
        ]
      },
      {
        id: 'themed-tarot-void',
        name: 'Obsidian Void',
        type: 'linear',
        note: 'The deep, infinite reach of space where light itself bends into darkness.',
        stops: [
          { hex: '#09080b', position: 0, label: 'Obsidian Core' },
          { hex: '#261b35', position: 50, label: 'Dark Nebula' },
          { hex: '#09080b', position: 100, label: 'Obsidian Core' }
        ]
      }
    ]
  },
  {
    id: 'cafes',
    name: 'Cafes in Paris & Seattle',
    subtitle: 'Espresso crema & zinc countertops',
    description: 'A study of rainy afternoons, steam, and conversation. Warm mahogany chairs, hot espresso foam, wet stone sidewalks, and the damp air of a Seattle corner cafe.',
    emoji: '☕',
    themeColor: '#d7a15c',
    gradients: [
      {
        id: 'themed-cafe-de-flore',
        name: 'Café de Flore',
        type: 'linear',
        note: 'Warm mahogany paneling, vintage brass trim, and a rich espresso with thick crema.',
        stops: [
          { hex: '#2a1a12', position: 0, label: 'Double Espresso' },
          { hex: '#bd8e62', position: 60, label: 'Foam Crema' },
          { hex: '#ede6dd', position: 100, label: 'Steamed Milk' }
        ]
      },
      {
        id: 'themed-cafe-seattle',
        name: 'Pike Place Rain',
        type: 'linear',
        note: 'Rain-slicked bricks, damp coastal cedar wood, and cool fog rolling off Puget Sound.',
        stops: [
          { hex: '#28363d', position: 0, label: 'Rainy Sidewalk' },
          { hex: '#62534a', position: 50, label: 'Damp Cedar' },
          { hex: '#c8d4d9', position: 100, label: 'Sound Fog' }
        ]
      }
    ]
  },
  {
    id: 'costco',
    name: 'Costco Wholesale',
    subtitle: 'Warehouse labels & hotdog combos',
    description: 'An ode to bulk packaging, fluorescent hangar bays, and concrete corridors. Comforting, nostalgic corporate red, yellow, and blue.',
    emoji: '🛒',
    themeColor: '#d32f2f',
    gradients: [
      {
        id: 'themed-costco-combo',
        name: 'Ketchup & Mustard Combo',
        type: 'linear',
        note: 'The legendary, unbeatable food court hot dog dressing combo.',
        stops: [
          { hex: '#c62828', position: 0, label: 'Heinz Ketchup Red' },
          { hex: '#f9a825', position: 100, label: 'French’s Mustard Yellow' }
        ]
      },
      {
        id: 'themed-costco-card',
        name: 'Gold Star Membership',
        type: 'linear',
        note: 'The golden passport to endless samples, sheet cakes, and giant teddy bears.',
        stops: [
          { hex: '#111115', position: 0, label: 'Executive Charcoal' },
          { hex: '#cfac62', position: 70, label: 'Gold Star' },
          { hex: '#e8dcbf', position: 100, label: 'Card Frost' }
        ]
      },
      {
        id: 'themed-costco-neon',
        name: 'Fluorescent Aisles',
        type: 'linear',
        note: 'The bright neon lights hanging from tall industrial beams over a pallet of toilet paper.',
        stops: [
          { hex: '#1e3c72', position: 0, label: 'Costco Corporate Blue' },
          { hex: '#e2e2e2', position: 100, label: 'Fluorescent Light' }
        ]
      }
    ]
  },
  {
    id: 'mekong',
    name: 'Mekong & HCMC Holidays',
    subtitle: 'Motorbikes in the rain & Hội An lanterns',
    description: 'Rich atmospheres of southern Vietnam. The heat, the steam, red lanterns glowing in ancient streets, motorbikes navigating wet asphalt, and the warm green tea of HCMC.',
    emoji: '🛵',
    themeColor: '#e65100',
    gradients: [
      {
        id: 'themed-mekong-hoian',
        name: 'Hội An Lanterns',
        type: 'linear',
        note: 'Warm crimson and glowing gold paper lanterns lighting up the Thu Bồn River at night.',
        stops: [
          { hex: '#8b0000', position: 0, label: 'Crimson Silk' },
          { hex: '#e67e22', position: 50, label: 'Lantern Glow' },
          { hex: '#f1c40f', position: 100, label: 'Paper Gold' }
        ]
      },
      {
        id: 'themed-mekong-monsoon',
        name: 'District 1 Monsoon',
        type: 'linear',
        note: 'Motorbike tail lights reflecting on rain-soaked asphalt and neon street signage in Ho Chi Minh City.',
        stops: [
          { hex: '#101016', position: 0, label: 'Wet Asphalt' },
          { hex: '#b81d4a', position: 60, label: 'Tail Light Ruby' },
          { hex: '#00ced1', position: 100, label: 'Neon Turquoise' }
        ]
      },
      {
        id: 'themed-mekong-jasmine',
        name: 'Mekong Jasmine Tea',
        type: 'linear',
        note: 'Warm, earthy green tea leaves steeping in ceramic cups along the river canals.',
        stops: [
          { hex: '#2c3e2f', position: 0, label: 'Steeped Leaf' },
          { hex: '#8fbc8f', position: 70, label: 'Jasmine Bud' },
          { hex: '#e0eee0', position: 100, label: 'Tea Steam' }
        ]
      }
    ]
  },
  {
    id: 'westernism',
    name: 'American Westernism',
    subtitle: 'Sagebrush gray, dry clay & rusted iron',
    description: 'The vast, dusty landscapes of the American frontier. Windblown tumbleweeds, dry canyon walls, weathered barn wood, and oxidized iron.',
    emoji: '🤠',
    themeColor: '#a18262',
    gradients: [
      {
        id: 'themed-west-rust',
        name: 'Dust Bowl Rust',
        type: 'linear',
        note: 'Oxidized iron and baked clay fences under a dry, cloudless prairie sky.',
        stops: [
          { hex: '#4e2f1d', position: 0, label: 'Deep Clay Canyon' },
          { hex: '#b34d26', position: 60, label: 'Oxidized Post' },
          { hex: '#e6ccb3', position: 100, label: 'Dry Dust' }
        ]
      },
      {
        id: 'themed-west-sage',
        name: 'Tumbleweed Sage',
        type: 'linear',
        note: 'Weathered silver-green sagebrush growing in sand mounds along the red rocks.',
        stops: [
          { hex: '#3d4035', position: 0, label: 'Sagebrush Shadow' },
          { hex: '#8a927a', position: 60, label: 'Sage Leaf Green' },
          { hex: '#eddcc4', position: 100, label: 'Sun-Bleached Sand' }
        ]
      }
    ]
  }
]
