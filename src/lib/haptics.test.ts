import { describe, it, expect, vi, afterEach } from 'vitest'
import { tickHaptic, primeHaptics } from './haptics'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('tickHaptic', () => {
  it('calls navigator.vibrate(10) when available', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    tickHaptic()
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('falls back to clicking a hidden switch checkbox when vibrate is absent', () => {
    vi.stubGlobal('navigator', {})
    tickHaptic()
    const input = document.querySelector('input[switch]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('checkbox')
    expect(input.checked).toBe(true) // click() toggled it

    tickHaptic()
    expect(document.querySelectorAll('input[switch]')).toHaveLength(1)
    expect(input.checked).toBe(false)
  })

  it('wraps the switch input in a fixed, near-invisible aria-hidden label', () => {
    vi.stubGlobal('navigator', {})
    tickHaptic()
    const input = document.querySelector('input[switch]') as HTMLInputElement
    const label = input.parentElement as HTMLLabelElement
    expect(label.tagName).toBe('LABEL')
    expect(label.getAttribute('aria-hidden')).toBe('true')
    expect(label.style.position).toBe('fixed')
    expect(label.style.opacity).toBe('0.01')
  })
})

describe('primeHaptics', () => {
  it('does nothing when navigator.vibrate is available', () => {
    vi.stubGlobal('navigator', { vibrate: vi.fn() })
    primeHaptics()
    expect(document.querySelector('input[switch]')).toBeNull()
  })

  it('pre-creates the hidden switch actuator when vibrate is absent', () => {
    vi.stubGlobal('navigator', {})
    primeHaptics()
    const input = document.querySelector('input[switch]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.checked).toBe(false) // primed, not clicked/ticked yet
  })

  it('reuses the same actuator element on a later tickHaptic call rather than creating a second one', () => {
    vi.stubGlobal('navigator', {})
    primeHaptics()
    const primed = document.querySelector('input[switch]') as HTMLInputElement
    tickHaptic()
    expect(document.querySelectorAll('input[switch]')).toHaveLength(1)
    expect(document.querySelector('input[switch]')).toBe(primed)
    expect(primed.checked).toBe(true)
  })
})
