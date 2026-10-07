import { describe, expect, it } from 'vitest'

import { filterSales, parseSaleFilter, summarizeSales } from '../saleSummary'

const sale = (total: number, paid: number, delivered: boolean) => ({
  total,
  paid,
  balance: total - paid,
  delivered,
})

const SALES = [sale(120, 120, true), sale(240, 100, false), sale(60, 0, false), sale(90, 100, true)]

describe('summarizeSales', () => {
  it('counts sales, sums total/paid/pending and delivered x of y', () => {
    expect(summarizeSales(SALES)).toEqual({
      count: 4,
      total: 510,
      paid: 320,
      // An overpaid sale (balance −10) does not lower what others still owe.
      pending: 200,
      delivered: 2,
      unpaid: 2,
      undelivered: 2,
    })
  })

  it('sums money in cents (no float drift)', () => {
    expect(summarizeSales([sale(0.1, 0, false), sale(0.2, 0, false)]).total).toBe(0.3)
  })

  it('is all zeros for no sales', () => {
    expect(summarizeSales([])).toEqual({
      count: 0,
      total: 0,
      paid: 0,
      pending: 0,
      delivered: 0,
      unpaid: 0,
      undelivered: 0,
    })
  })
})

describe('filterSales', () => {
  it('keeps unpaid or undelivered sales, or all of them', () => {
    expect(filterSales(SALES, 'all')).toHaveLength(4)
    expect(filterSales(SALES, 'unpaid')).toEqual([SALES[1], SALES[2]])
    expect(filterSales(SALES, 'undelivered')).toEqual([SALES[1], SALES[2]])
  })
})

describe('parseSaleFilter', () => {
  it('accepts known filters and falls back to all', () => {
    expect(parseSaleFilter('unpaid')).toBe('unpaid')
    expect(parseSaleFilter('undelivered')).toBe('undelivered')
    expect(parseSaleFilter('bogus')).toBe('all')
    expect(parseSaleFilter(undefined)).toBe('all')
    expect(parseSaleFilter(['unpaid'])).toBe('all')
  })
})
