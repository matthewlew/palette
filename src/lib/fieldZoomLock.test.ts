import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFieldZoomLock, ZOOM_LOCK } from './fieldZoomLock'

const BASE = 'width=device-width, initial-scale=1.0, viewport-fit=cover'

let teardown: () => void = () => {}

function setViewportMeta(content = BASE) {
  document.head.innerHTML = `<meta name="viewport" content="${content}">`
  return document.querySelector('meta[name="viewport"]') as HTMLMetaElement
}

/** Reports the platform as touch-like (or not), matching index.css's test. */
function stubTouchPlatform(touchLike: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: touchLike }),
  )
}

beforeEach(() => {
  document.body.innerHTML = ''
  setViewportMeta()
  stubTouchPlatform(true)
})

afterEach(() => {
  teardown()
  teardown = () => {}
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('installFieldZoomLock', () => {
  it('pins maximum-scale while a text field has focus and releases it on blur', () => {
    const meta = setViewportMeta()
    document.body.innerHTML = '<input type="text" id="title">'
    teardown = installFieldZoomLock()
    const input = document.getElementById('title')!

    expect(meta.content).toBe(BASE)

    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(meta.content).toBe(`${BASE}, ${ZOOM_LOCK}`)

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    // Pinch-zoom comes straight back — the lock covers the focused window only.
    expect(meta.content).toBe(BASE)
  })

  it('covers textareas, selects, and contenteditable regions too', () => {
    const meta = setViewportMeta()
    document.body.innerHTML =
      '<textarea id="t"></textarea><select id="s"></select><div id="c" contenteditable="true"></div>'
    teardown = installFieldZoomLock()

    for (const id of ['t', 's', 'c']) {
      const el = document.getElementById(id)!
      el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      expect(meta.content).toBe(`${BASE}, ${ZOOM_LOCK}`)
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      expect(meta.content).toBe(BASE)
    }
  })

  it('ignores focus on controls that open no keyboard, so pinch-zoom survives them', () => {
    const meta = setViewportMeta()
    // EditMode focuses a hidden color input programmatically; locking the
    // viewport around a native color picker would cost pinch-zoom for nothing.
    document.body.innerHTML =
      '<input type="color" id="c"><input type="checkbox" id="k"><button id="b"></button>'
    teardown = installFieldZoomLock()

    for (const id of ['c', 'k', 'b']) {
      document.getElementById(id)!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      expect(meta.content).toBe(BASE)
    }
  })

  it('does nothing on a platform that does not zoom focused fields', () => {
    stubTouchPlatform(false)
    const meta = setViewportMeta()
    document.body.innerHTML = '<input type="text" id="title">'
    teardown = installFieldZoomLock()

    document.getElementById('title')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(meta.content).toBe(BASE)
  })

  it('leaves a viewport that already pins the scale alone', () => {
    const pinned = `${BASE}, maximum-scale=2`
    const meta = setViewportMeta(pinned)
    document.body.innerHTML = '<input type="text" id="title">'
    teardown = installFieldZoomLock()

    const input = document.getElementById('title')!
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(meta.content).toBe(pinned)
    // And no blur handler that would rewrite it to something else.
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(meta.content).toBe(pinned)
  })

  it('restores the untouched viewport on teardown, even mid-focus', () => {
    const meta = setViewportMeta()
    document.body.innerHTML = '<input type="text" id="title">'
    const stop = installFieldZoomLock()

    document.getElementById('title')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(meta.content).toBe(`${BASE}, ${ZOOM_LOCK}`)

    stop()
    expect(meta.content).toBe(BASE)

    // Listeners are gone: a later focus no longer touches the meta.
    document.getElementById('title')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(meta.content).toBe(BASE)
  })

  it('is inert when the document has no viewport meta', () => {
    document.head.innerHTML = ''
    document.body.innerHTML = '<input type="text" id="title">'
    expect(() => {
      teardown = installFieldZoomLock()
      document.getElementById('title')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    }).not.toThrow()
  })
})
