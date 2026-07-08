// iOS Safari has no navigator.vibrate. Safari 18+ fires a system haptic when
// a <input type="checkbox" switch> is toggled during a user gesture, so a
// hidden switch input doubles as a haptic actuator on iPhone. Safari is picky
// about the actuator: it must be rendered (not display:none / fully
// transparent / offscreen) and the toggle must be dispatched via a <label>
// click for the haptic to fire reliably, so we keep a 1px, ~invisible
// label+switch pinned in the viewport.
let actuatorLabel: HTMLLabelElement | null = null

function ensureActuator(): HTMLLabelElement {
  if (actuatorLabel && actuatorLabel.isConnected) return actuatorLabel
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;overflow:hidden;z-index:-1'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  actuatorLabel = label
  return label
}

/** Pre-creates the hidden switch actuator so the first real tick doesn't
 * pay the cost of DOM insertion mid-gesture. Safe to call any time. */
export function primeHaptics(): void {
  if (typeof document !== 'undefined' && !('vibrate' in navigator)) {
    ensureActuator()
  }
}

/** One short haptic tick, used per feed step. */
export function tickHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  } else if (typeof document !== 'undefined') {
    ensureActuator().click()
  }
}
