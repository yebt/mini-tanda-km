import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatMoney } from '../format'
import { currency } from '../settings'

afterEach(() => {
  vi.unstubAllGlobals()
  currency.value = 'MXN'
})

describe('formatMoney locale', () => {
  it("formats with the user's locale, so MXN reads as $ in Mexico", () => {
    vi.stubGlobal('navigator', { language: 'es-MX', languages: ['es-MX'] })
    expect(formatMoney(1234.5)).toBe('$1,234.50')
  })

  it('falls back to en-US when the locale is missing or invalid', () => {
    vi.stubGlobal('navigator', { language: 'not a locale', languages: [] })
    expect(formatMoney(1234.5)).toBe('MX$1,234.50')
  })
})
