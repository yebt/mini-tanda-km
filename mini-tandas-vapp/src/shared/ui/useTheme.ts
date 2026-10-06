import { shallowRef } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'mini-tanda-theme'

/** Reactive active theme. Mirrors `data-theme` on <html>. */
export const theme = shallowRef<Theme>('light')

/** Browser chrome color per theme: matches `--color-surface` (the app header). */
export const THEME_COLORS: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#2a211a',
}

function applyTheme(value: Theme): void {
  document.documentElement.dataset.theme = value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[value])
}

function resolveInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Restore persisted theme (or OS preference) and set data-theme. Call once at startup. */
export function initTheme(): void {
  theme.value = resolveInitialTheme()
  applyTheme(theme.value)
}

export function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, theme.value)
  applyTheme(theme.value)
}
