import { describe, it, expect, vi, afterEach } from 'vitest'
import { tickHaptic } from './haptics'

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
})
