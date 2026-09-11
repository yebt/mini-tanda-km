import { formatMoney } from '@shared/db/format'
import type { PriceRow, Product } from '@shared/db/types'

/** Stable lookup key for an option-id combination (sorted JSON). */
export function comboKey(optionIds: string[]): string {
  return JSON.stringify([...optionIds].sort())
}

/** The product's variations that drive pricing, in variation order. */
export function pricingVariationsOf(product: Product) {
  return product.variations.filter((variation) => product.priceVariationIds.includes(variation.id))
}

/**
 * One entry per combination of the pricing variations' options (cartesian
 * product). Empty when no pricing variation is chosen or any of them has no
 * options yet.
 */
export function pricingCombos(product: Product): string[][] {
  const variations = pricingVariationsOf(product)
  if (variations.length === 0 || variations.some((variation) => variation.options.length === 0)) {
    return []
  }
  return variations.reduce<string[][]>(
    (combinations, variation) =>
      combinations.flatMap((combo) => variation.options.map((option) => [...combo, option.id])),
    [[]],
  )
}

/** Human label for a combination: option labels joined ' · ' in variation order. */
export function comboLabel(product: Product, combo: string[]): string {
  const labels: string[] = []
  for (const variation of pricingVariationsOf(product)) {
    const option = variation.options.find((candidate) => combo.includes(candidate.id))
    labels.push(option?.label ?? '?')
  }
  return labels.join(' · ')
}

export interface PricingSummary {
  /** Main price line, e.g. "$100.00" or "By SIZE + PACKAGING". */
  heading: string
  /** Muted secondary line, e.g. "2/4 prices set" — '' when not applicable. */
  detail: string
  hasPrices: boolean
  minPrice: number | null
  pricedCount: number
  comboCount: number
}

/** Price display summary for a product in list/card views. */
export function summarizePricing(product: Product, priceRows: PriceRow[]): PricingSummary {
  if (product.priceMode === 'global') {
    return {
      heading: product.price != null ? formatMoney(product.price) : 'No price set',
      detail: '',
      hasPrices: product.price != null,
      minPrice: product.price,
      pricedCount: product.price != null ? 1 : 0,
      comboCount: 1,
    }
  }
  const names = pricingVariationsOf(product).map((variation) => variation.name)
  const combos = pricingCombos(product)
  const pricedCount = combos.filter((combo) =>
    priceRows.some((row) => comboKey(row.optionIds) === comboKey(combo)),
  ).length
  const hasPrices = priceRows.length > 0
  const minPrice = hasPrices ? Math.min(...priceRows.map((row) => row.price)) : null
  const detail =
    names.length === 0
      ? 'Choose which variations set the price'
      : combos.length === 0
        ? 'Add options to the pricing variations'
        : `${pricedCount}/${combos.length} prices set`
  return {
    heading: names.length ? `By ${names.join(' + ')}` : 'By variations',
    detail,
    hasPrices,
    minPrice,
    pricedCount,
    comboCount: combos.length,
  }
}

/** Variation overview for tables: "FLAVOR (3) · SIZE (2)" — '' when none. */
export function summarizeVariations(product: Product): string {
  return product.variations
    .map((variation) => `${variation.name} (${variation.options.length})`)
    .join(' · ')
}
