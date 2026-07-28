/**
 * Stops the browser magnifying the whole app when a text field takes focus.
 *
 * index.css already puts a 16px floor under every field, which covers Safari's
 * best-known zoom trigger. It is not the only one: Safari also zooms to bring a
 * focused field to a comfortable size and position, and on a viewport-locked
 * layout like this one — `height: 100dvh`, nothing scrollable, chrome pinned
 * over a full-bleed canvas — it has no scrolling it can do instead. The result
 * is a magnified, horizontally pannable app, and NOTHING zooms it back: the
 * scale outlives the field it was applied for, so one tap on a title leaves the
 * app wrong until the tab is reloaded.
 *
 * `maximum-scale=1` on the viewport meta is the only thing that suppresses that
 * zoom, and index.css already records why it was rejected as a permanent
 * setting: it takes pinch-zoom away from everyone, trading an annoyance for an
 * accessibility failure. So this scopes it to exactly the window where the
 * automatic zoom can fire — from focus to blur — and hands pinch-zoom straight
 * back afterwards. Clamping to 1 on the way in is also what recovers an
 * already-zoomed app, since a scale above the new maximum is pulled down to it.
 *
 * Installed once at the document level rather than per field, matching the
 * font-size floor it backs up: this is a property of the PLATFORM, not of any
 * one input, and the next field added should not have to remember it.
 */

// Every field the browser opens a keyboard for. The exclusions are the input
// types that are buttons or non-textual pickers — they take focus without
// putting a caret anywhere, so they never trigger the zoom, and locking the
// viewport around them would only take pinch-zoom away for no reason. The
// color input EditMode drives programmatically is in that group.
const FIELD_SELECTOR = [
  'input:not([type="button"]):not([type="checkbox"]):not([type="color"])' +
    ':not([type="file"]):not([type="hidden"]):not([type="image"])' +
    ':not([type="radio"]):not([type="range"]):not([type="reset"]):not([type="submit"])',
  'select',
  'textarea',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(',')

export const ZOOM_LOCK = 'maximum-scale=1'

function isField(target: EventTarget | null): boolean {
  return target instanceof Element && target.matches(FIELD_SELECTOR)
}

/**
 * Returns a teardown function, which also restores the untouched viewport meta
 * — so a lock left on by a field that never blurred can't leak.
 */
export function installFieldZoomLock(doc: Document = document): () => void {
  const noop = () => {}
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  const win = doc.defaultView
  if (!meta || !win || typeof win.matchMedia !== 'function') return noop

  // Same test as the font-size floor in index.css, deliberately: the two rules
  // answer the same question ("can this platform zoom a focused field?") and
  // would be a bug if they ever disagreed. An iPad with a trackpad reports
  // `pointer: fine` and still zooms, so neither signal alone is enough.
  const touchLike =
    win.matchMedia('(pointer: coarse)').matches || win.matchMedia('(max-width: 767px)').matches
  if (!touchLike) return noop

  const base = meta.content
  // Someone already pinned the scale in the document itself; leave it be rather
  // than restoring to a value that would silently re-enable the zoom on blur.
  if (base.includes('maximum-scale')) return noop
  const locked = `${base}, ${ZOOM_LOCK}`

  function lock(e: FocusEvent) {
    if (isField(e.target)) meta!.content = locked
  }

  function unlock(e: FocusEvent) {
    if (isField(e.target)) meta!.content = base
  }

  doc.addEventListener('focusin', lock)
  doc.addEventListener('focusout', unlock)
  return () => {
    doc.removeEventListener('focusin', lock)
    doc.removeEventListener('focusout', unlock)
    meta.content = base
  }
}
