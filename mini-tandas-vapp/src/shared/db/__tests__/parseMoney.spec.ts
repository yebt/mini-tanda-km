import { describe, expect, it } from 'vitest'

import { parseMoneyInput } from '../money'

describe('parseMoneyInput', () => {
  it('treats blank input as "no value"', () => {
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('   ')).toBeNull()
  })

  it('accepts plain, grouped, symbol-prefixed and comma-decimal amounts', () => {
    expect(parseMoneyInput('90')).toBe(90)
    expect(parseMoneyInput('0')).toBe(0)
    expect(parseMoneyInput('12.5')).toBe(12.5)
    expect(parseMoneyInput('1,234.50')).toBe(1234.5)
    expect(parseMoneyInput('$ 1,234.50')).toBe(1234.5)
    expect(parseMoneyInput('12,5')).toBe(12.5)
    expect(parseMoneyInput('1.234,50')).toBe(1234.5)
  })

  it('rejects anything that is not a non-negative amount', () => {
    expect(parseMoneyInput('abc')).toBeNaN()
    expect(parseMoneyInput('-5')).toBeNaN()
    expect(parseMoneyInput('1e3')).toBeNaN()
  })
})
