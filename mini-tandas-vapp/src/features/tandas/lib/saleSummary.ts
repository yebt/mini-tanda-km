import { fromCents, toCents } from '@shared/db/money'

/** The fields of a sale the tanda summary and filters read. */
interface SaleFigures {
  total: number
  paid: number
  balance: number
  delivered: boolean
}

export interface SalesSummary {
  count: number
  total: number
  paid: number
  /** What clients still owe on these sales (overpaid sales count as 0). */
  pending: number
  delivered: number
  unpaid: number
  undelivered: number
}

export const SALE_FILTERS = ['all', 'unpaid', 'undelivered'] as const
export type SaleFilter = (typeof SALE_FILTERS)[number]

/** Totals for a tanda's sales, summed in cents. */
export function summarizeSales(sales: readonly SaleFigures[]): SalesSummary {
  let total = 0
  let paid = 0
  let pending = 0
  let delivered = 0
  let unpaid = 0
  for (const sale of sales) {
    total += toCents(sale.total)
    paid += toCents(sale.paid)
    if (sale.balance > 0) {
      pending += toCents(sale.balance)
      unpaid++
    }
    if (sale.delivered) delivered++
  }
  return {
    count: sales.length,
    total: fromCents(total),
    paid: fromCents(paid),
    pending: fromCents(pending),
    delivered,
    unpaid,
    undelivered: sales.length - delivered,
  }
}

export function filterSales<T extends SaleFigures>(sales: readonly T[], filter: SaleFilter): T[] {
  if (filter === 'unpaid') return sales.filter((sale) => sale.balance > 0)
  if (filter === 'undelivered') return sales.filter((sale) => !sale.delivered)
  return [...sales]
}

/** The filter named by `?filter=`; anything unknown shows every sale. */
export function parseSaleFilter(value: unknown): SaleFilter {
  return SALE_FILTERS.find((filter) => filter === value) ?? 'all'
}
