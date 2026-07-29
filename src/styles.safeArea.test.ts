import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Every stylesheet in the app, read as text. These are layout invariants that
 * no jsdom render can check — jsdom has no layout and no env() — but they are
 * exactly the class of bug that only shows up on a real handset, held
 * sideways, which is the worst place to find it. */
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) cssFiles(path, out)
    else if (entry.name.endsWith('.css')) out.push(path)
  }
  return out
}

const FILES = cssFiles('src')
const MODULES = FILES.filter((f) => !f.endsWith('index.css'))

describe('safe-area handling', () => {
  it('reads the cutout through tokens everywhere except where they are defined', () => {
    // env() cannot be overridden, which makes a notch impossible to simulate in
    // a browser check — the insets are only observable on real hardware. Every
    // read going through a custom property is what makes the landscape layout
    // testable at all, so a stray env() is a hole in the coverage, not just an
    // inconsistency.
    const offenders = MODULES.filter((f) => readFileSync(f, 'utf8').includes('env(safe-area-inset'))
    expect(offenders).toEqual([])
  })

  it('defines all four insets, both horizontal gutters, and the tab bar footprint', () => {
    const root = readFileSync('src/index.css', 'utf8')
    for (const token of ['--safe-t', '--safe-r', '--safe-b', '--safe-l', '--edge-l', '--edge-r', '--tabbar-top']) {
      expect(root).toContain(`${token}:`)
    }
    // The gutters must carry the horizontal insets, or a control pinned with
    // them still slides under the camera housing in landscape.
    expect(root).toMatch(/--edge-l:\s*calc\(16px \+ var\(--safe-l\)\)/)
    expect(root).toMatch(/--edge-r:\s*calc\(16px \+ var\(--safe-r\)\)/)
    // And the bar's footprint must include the home indicator beneath it.
    const tabbarTop = root.match(/--tabbar-top:[^;]+/)?.[0] ?? ''
    expect(tabbarTop).toContain('var(--safe-b)')
    expect(tabbarTop).toContain('var(--tabbar-h)')
  })

  it('pins no viewport-fixed control to a bare 16px horizontal edge', () => {
    // Held sideways an iPhone puts ~59px of cutout on each short edge, so
    // `left: 16px` and `right: 16px` land under the camera housing and the
    // home indicator. Anything anchored to a screen edge has to go through
    // --edge-l / --edge-r.
    //
    // `position: fixed` only. An absolute block may be anchored to a modal
    // panel that never reaches the screen edge (the export dialog's spinner
    // is), and there is no way to tell which from the text alone — those are
    // covered by the named-control check below and by the browser audit.
    const anchored: string[] = []
    for (const file of MODULES) {
      for (const block of readFileSync(file, 'utf8').split('}')) {
        if (!/position:\s*fixed/.test(block)) continue
        if (/(^|\s)(left|right):\s*16px\s*;/.test(block)) {
          anchored.push(`${file}: ${block.trim().split('\n')[0]}`)
        }
      }
    }
    expect(anchored).toEqual([])
  })

  it('routes every full-screen surface control through the gutter tokens', () => {
    // These are absolutely positioned inside a container that IS the viewport,
    // so they are edge anchors even though they are not `fixed`.
    const controls: [string, string][] = [
      ['src/components/EditMode.module.css', '--edge-l'],
      ['src/components/GradientPage.module.css', '--edge-l'],
      ['src/components/LikeButton.module.css', '--edge-r'],
      ['src/components/PlayButton.module.css', '--edge-r'],
      ['src/components/BoardShare.module.css', '--edge-r'],
      ['src/components/Gallery.module.css', '--edge-l'],
      ['src/components/Gallery.module.css', '--edge-r'],
    ]
    for (const [file, token] of controls) {
      expect(readFileSync(file, 'utf8'), `${file} should anchor with ${token}`).toContain(token)
    }
  })

  it('floats the hint above the tab bar by construction, not by a copied number', () => {
    // It was `bottom: 96px` flat while the bar sits at 18 + 46 + the home
    // indicator. On a phone with a 34px indicator that puts the bar's top edge
    // at 98 and the toast's bottom at 96 — a 2px overlap, measured.
    const hint = readFileSync('src/components/Hint.module.css', 'utf8')
    expect(hint).toContain('var(--tabbar-top)')
    // Comments stripped: the one above the rule quotes the old value.
    const declarations = hint.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toMatch(/bottom:\s*96px/)
    // Every bottom offset in here carries the indicator inset one way or another.
    for (const decl of declarations.match(/bottom:[^;]+/g) ?? []) {
      expect(decl, decl).toMatch(/var\(--tabbar-top\)|var\(--safe-b\)/)
    }
  })
})
