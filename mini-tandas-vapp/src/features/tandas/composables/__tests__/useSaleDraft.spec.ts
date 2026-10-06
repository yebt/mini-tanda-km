import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { formatMoney } from '@shared/db/format'
import type { InventoryEntry, SaleWithDetails, SkuWithProduct, TandaType } from '@shared/db/types'
import { useInventoryAvailability, useSaleDraft, type CatalogGroup } from '../useSaleDraft'

function sku(id: string, label: string, price: number | null): SkuWithProduct {
  return { id, productId: 'p1', optionIds: [id], productName: 'Cake', label, price }
}

const personal = sku('s-personal', 'Personal', 90)
const family = sku('s-family', 'Family', 120)
const unpriced = sku('s-mini', 'Mini', null)
const catalog: CatalogGroup[] = [
  { product: { id: 'p1', name: 'Cake' }, skus: [personal, family, unpriced] },
]

function entry(skuValue: SkuWithProduct, produced: number, sold: number): InventoryEntry {
  return {
    sku: skuValue,
    productName: 'Cake',
    label: skuValue.label,
    produced,
    sold,
    available: produced - sold,
  }
}

let scope = effectScope()
beforeEach(() => {
  scope = effectScope()
})
afterEach(() => scope.stop())

function draft(
  type: TandaType,
  inventory: InventoryEntry[] = [],
  extra: { initialSale?: SaleWithDetails; initialSkuId?: string } = {},
) {
  return scope.run(() =>
    useSaleDraft({ type, catalog: () => catalog, inventory: () => inventory, ...extra }),
  )!
}

describe('useInventoryAvailability', () => {
  it('looks up produced / sold / available per SKU, defaulting to 0', () => {
    const inventory = ref([entry(personal, 5, 2)])
    const { producedOf, soldOf, availableOf } = useInventoryAvailability(inventory)
    expect([producedOf(personal.id), soldOf(personal.id), availableOf(personal.id)]).toEqual([
      5, 2, 3,
    ])
    expect(availableOf(family.id)).toBe(0)
    inventory.value = [entry(personal, 5, 5)]
    expect(availableOf(personal.id)).toBe(0)
  })
})

describe('useSaleDraft — product options', () => {
  it('scheduled tandas only disable unpriced SKUs and show no stock count', () => {
    const { skuOptions } = draft('scheduled')
    expect(skuOptions.value).toEqual([
      {
        value: personal.id,
        label: 'Cake (Personal)',
        hint: formatMoney(90),
        disabled: false,
        disabledReason: 'Out of stock',
      },
      {
        value: family.id,
        label: 'Cake (Family)',
        hint: formatMoney(120),
        disabled: false,
        disabledReason: 'Out of stock',
      },
      {
        value: unpriced.id,
        label: 'Cake (Mini)',
        hint: 'no price',
        disabled: true,
        disabledReason: 'No price set',
      },
    ])
  })

  it('anticipated tandas disable SKUs without stock', () => {
    const { skuOptions } = draft('anticipated', [entry(personal, 3, 1), entry(family, 2, 2)])
    const [p, f] = skuOptions.value
    expect(p).toMatchObject({ hint: `${formatMoney(90)} · 2 available`, disabled: false })
    expect(f).toMatchObject({
      hint: `no stock · ${formatMoney(120)}`,
      disabled: true,
      disabledReason: 'Out of stock',
    })
  })
})

describe('useSaleDraft — lines', () => {
  it('adds lines, merges the same SKU and keeps a running total', () => {
    const d = draft('scheduled')
    d.selectedSkuId.value = personal.id
    d.quantity.value = 2
    expect(d.addLine()).toBe(true)
    d.selectedSkuId.value = personal.id
    d.quantity.value = 1
    d.addLine()
    expect(d.lines.value).toEqual([
      { skuId: personal.id, label: 'Cake (Personal)', price: 90, quantity: 3 },
    ])
    expect(d.runningTotal.value).toBe(270)
    expect(d.selectedSkuId.value).toBe('')
    expect(d.quantity.value).toBe(1)
  })

  it('reports validation errors instead of adding', async () => {
    const d = draft('scheduled')
    expect(d.addLine()).toBe(false)
    expect(d.error.value).toBe('Pick a product first.')

    d.selectedSkuId.value = unpriced.id
    await nextTick()
    d.addLine()
    expect(d.error.value).toBe('"Cake" has no price set.')

    d.selectedSkuId.value = personal.id
    d.quantity.value = 1.5
    await nextTick()
    d.addLine()
    expect(d.error.value).toBe('Quantity must be a whole number of at least 1.')

    // Editing the pending line clears the stale error.
    d.quantity.value = 2
    await nextTick()
    expect(d.error.value).toBe('')
  })

  it('caps anticipated lines to the available stock', () => {
    const d = draft('anticipated', [entry(personal, 3, 0)])
    d.selectedSkuId.value = personal.id
    expect(d.remainingForSelected.value).toBe(3)
    d.quantity.value = 2
    d.addLine()

    d.selectedSkuId.value = personal.id
    expect(d.remainingForSelected.value).toBe(1)
    d.bumpQty(1)
    expect(d.quantity.value).toBe(1)
    expect(d.canBumpQtyUp.value).toBe(false)
    d.quantity.value = 2
    expect(d.addLine()).toBe(false)
    expect(d.error.value).toBe('Only 1 available for Personal.')

    const line = d.lines.value[0]!
    expect(d.lineStockLabel(line)).toBe('1 left')
    d.bumpLine(line, 5)
    expect(line.quantity).toBe(3)
    expect(d.lineStockLabel(line)).toBe('none left')
    expect(d.setLineQuantity(line, 10)).toBe(3)
    expect(d.setLineQuantity(line, 0)).toBe(3)
    expect(d.setLineQuantity(line, 1)).toBe(1)
  })

  it('scheduled lines have no stock cap or stock label', () => {
    const d = draft('scheduled')
    d.selectedSkuId.value = personal.id
    d.addLine()
    const line = d.lines.value[0]!
    expect(d.remainingForSelected.value).toBeNull()
    expect(d.lineCap(line)).toBe(Number.POSITIVE_INFINITY)
    expect(d.lineStockLabel(line)).toBeNull()
  })

  it('removes lines and resets the draft', () => {
    const d = draft('scheduled', [], { initialSkuId: family.id })
    expect(d.selectedSkuId.value).toBe(family.id)
    d.addLine()
    d.removeLine(family.id)
    expect(d.lines.value).toEqual([])
    d.selectedSkuId.value = personal.id
    d.addLine()
    d.reset()
    expect(d.lines.value).toEqual([])
    expect(d.selectedSkuId.value).toBe('')
    expect(d.items()).toEqual([])
  })
})

describe('useSaleDraft — editing a sale', () => {
  const sale: SaleWithDetails = {
    id: 'sale-1',
    tandaId: 't1',
    clientId: 'c1',
    delivered: false,
    createdAt: 'now',
    client: { id: 'c1', name: 'Ana', createdAt: 'now' },
    items: [
      { skuId: personal.id, label: 'Cake (Personal)', quantity: 2, unitPrice: 80, lineTotal: 160 },
    ],
    total: 160,
    paid: 0,
    balance: 160,
  }

  it('prefills lines with their snapshot price and counts own stock as available', () => {
    // 3 produced, 2 of them sold to this very sale.
    const d = draft('anticipated', [entry(personal, 3, 2)], {
      initialSale: sale,
      initialSkuId: family.id,
    })
    expect(d.selectedSkuId.value).toBe('')
    expect(d.lines.value).toEqual([
      { skuId: personal.id, label: 'Cake (Personal)', price: 80, quantity: 2 },
    ])
    expect(d.stockLimitOf(personal.id)).toBe(3)
    expect(d.lineStockLabel(d.lines.value[0]!)).toBe('1 left')
    expect(d.items()).toEqual([{ skuId: personal.id, quantity: 2 }])
  })
})
