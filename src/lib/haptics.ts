// iOS Safari has no navigator.vibrate. Safari 18+ fires a system haptic when
// a <input type="checkbox" switch> is toggled during a user gesture, so a
// hidden switch input doubles as a haptic actuator on iPhone.
let switchInput: HTMLInputElement | null = null

function iosSwitchHaptic(): void {
  if (!switchInput || !switchInput.isConnected) {
    switchInput = document.createElement('input')
    switchInput.type = 'checkbox'
    switchInput.setAttribute('switch', '')
    switchInput.style.cssText = 'position:fixed;left:-100px;opacity:0;pointer-events:none'
    document.body.appendChild(switchInput)
  }
  switchInput.click()
}

/** One short haptic tick, used per feed step. */
export function tickHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  } else if (typeof document !== 'undefined') {
    iosSwitchHaptic()
  }
}
