import { describe, it, expect } from 'vitest'
import { getRadialConfig } from './gradient'

/* The origin bug that made shared posts render the wrong Turrell nest.
 *
 * getRadialConfig treats null/undefined as CENTRE and 0 as TOP. Those are two
 * different origins, so any `angle ?? 0` on a publish or load path silently
 * re-anchors a centred gradient to the top edge. These tests pin the semantics
 * so the coercion cannot creep back in. */

describe('origin semantics', () => {
  it('treats undefined and 0 as DIFFERENT origins', () => {
    expect(getRadialConfig(undefined)).toEqual({ css: 'center', px: 0.5, py: 0.5 })
    expect(getRadialConfig(0)).toEqual({ css: 'top', px: 0.5, py: 0 })
    expect(getRadialConfig(undefined)).not.toEqual(getRadialConfig(0))
  })

  it('treats null as centre too, since that is what the database stores', () => {
    expect(getRadialConfig(null as unknown as undefined)).toEqual({ css: 'center', px: 0.5, py: 0.5 })
  })

  it('maps every eighth-turn to its own anchor', () => {
    const anchors = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => getRadialConfig(a).css)
    expect(anchors).toEqual([
      'top', 'top right', 'right', 'bottom right',
      'bottom', 'bottom left', 'left', 'top left',
    ])
    expect(new Set(anchors).size).toBe(8)
  })
})

describe('the round trip a shared post makes', () => {
  // What publishPalette writes, and what the loaders read back.
  const publish = (angle?: number) => angle ?? null
  const load = (stored: number | null) => stored ?? undefined

  it('preserves a centred gradient', () => {
    const original = undefined
    const restored = load(publish(original))
    expect(getRadialConfig(restored)).toEqual(getRadialConfig(original))
    expect(getRadialConfig(restored).css).toBe('center')
  })

  it('preserves every explicit origin', () => {
    for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
      expect(getRadialConfig(load(publish(angle)))).toEqual(getRadialConfig(angle))
    }
  })

  it('would have broken centre under the old `angle ?? 0` coercion', () => {
    const oldPublish = (angle?: number) => angle ?? 0
    const oldLoad = (stored: number | null) => stored ?? 0
    expect(getRadialConfig(oldLoad(oldPublish(undefined))).css).toBe('top')
    // ...which is exactly the reported symptom.
    expect(getRadialConfig(oldLoad(oldPublish(undefined))))
      .not.toEqual(getRadialConfig(undefined))
  })
})
