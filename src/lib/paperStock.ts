/**
 * Paper stocks offered in the plate-preview screen (not the export — the
 * exported PDF is always a flattened white-base grayscale raster, per PRD
 * §6 item 4; the stock only tints and textures the on-screen preview so it
 * reads closer to what the ink will actually sit on). Four options, all with
 * the vellum/toothy-finish tooth the PRD's ink-adhesion note calls for —
 * smooth coated stocks are deliberately not offered here, since they're the
 * one thing riso printers are told to avoid.
 */
export interface PaperStock {
  id: string
  name: string
  /** Base tint the plate raster composites onto, replacing flat white. */
  color: string
  /** feTurbulence baseFrequency for PaperTexture — lower reads as coarser
   * tooth, higher as finer/smoother vellum grain. */
  frequency: number
  /** Overlay opacity for PaperTexture — how visible the tooth is. */
  grain: number
}

export const PAPER_STOCKS: PaperStock[] = [
  {
    id: 'french-speckletone',
    name: 'French Paper Co. Speckletone',
    color: '#f2ede0',
    frequency: 0.35,
    grain: 0.16,
  },
  {
    id: 'mohawk-superfine',
    name: 'Mohawk Superfine',
    color: '#faf8f2',
    frequency: 0.55,
    grain: 0.09,
  },
  {
    id: 'domtar-cougar',
    name: 'Domtar Cougar',
    color: '#f6f4ec',
    frequency: 0.45,
    grain: 0.12,
  },
  {
    id: 'vellum',
    name: 'Vellum',
    color: '#faf9f5',
    frequency: 0.8,
    grain: 0.06,
  },
]

export const DEFAULT_PAPER_STOCK = PAPER_STOCKS[0]

export function findPaperStock(id: string): PaperStock {
  return PAPER_STOCKS.find((s) => s.id === id) ?? DEFAULT_PAPER_STOCK
}
