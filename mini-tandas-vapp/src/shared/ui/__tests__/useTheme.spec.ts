import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { initTheme, theme, toggleTheme } from '../useTheme'

function themeColor(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null
}

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  })
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff">'
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('theme', () => {
  it('keeps the browser chrome color in step with the active theme', () => {
    initTheme()
    expect(theme.value).toBe('light')
    expect(themeColor()).toBe('#ffffff')

    toggleTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(themeColor()).toBe('#2a211a')

    toggleTheme()
    expect(themeColor()).toBe('#ffffff')
  })
})
