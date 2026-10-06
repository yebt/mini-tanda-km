// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** WCAG 2.x contrast checks over the design tokens in main.css (both themes). */
const css = readFileSync(new URL('../main.css', import.meta.url), 'utf8')

function tokensOf(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries(
    [...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  )
}

const light = tokensOf(':root')
const themes = { light, dark: { ...light, ...tokensOf("html[data-theme='dark']") } }

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe.each(Object.entries(themes))('%s theme tokens', (_theme, t) => {
  it.each([
    ['primary-ink', 'primary-soft'],
    ['warning-ink', 'warning-soft'],
    ['success-ink', 'success-soft'],
    ['danger', 'danger-soft'],
  ])('badge text %s on %s is >= 4.5:1', (ink, background) => {
    expect(contrast(t[ink]!, t[background]!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['control-border', 'surface'],
    ['control-border', 'bg'],
    ['focus-ring', 'surface'],
    ['focus-ring', 'bg'],
  ])('%s against %s is >= 3:1', (token, background) => {
    expect(contrast(t[token]!, t[background]!)).toBeGreaterThanOrEqual(3)
  })
})
