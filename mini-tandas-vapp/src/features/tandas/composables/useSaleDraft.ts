import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { formatMoney } from '@shared/db/format'
import type {
  InventoryEntry,
  Product,
  SaleWithDetails,
  SkuWithProduct,
  TandaType,
} from '@shared/db/types'
import { tracksInventory } from '@shared/domain/tanda'
import type { ComboOption } from '@shared/ui/Combobox.vue'

export interface DraftLine {
  skuId: string
  label: string
  /** Unit price (snapshot price for lines of the sale being edited). */
  price: number
  quantity: number
}

export interface CatalogGroup {
  product: Pick<Product, 'id' | 'name'>
  skus: SkuWithProduct[]
}

/** Per-SKU produced / sold / available lookups over a tanda's inventory (0 when absent). */
export function useInventoryAvailability(inventory: MaybeRefOrGetter<InventoryEntry[]>) {
  const bySku = computed(() => new Map(toValue(inventory).map((entry) => [entry.sku.id, entry])))
  return {
    producedOf: (skuId: string): number => bySku.value.get(skuId)?.produced ?? 0,
    soldOf: (skuId: string): number => bySku.value.get(skuId)?.sold ?? 0,
    availableOf: (skuId: string): number => bySku.value.get(skuId)?.available ?? 0,
  }
}

function lineLabel(sku: Pick<SkuWithProduct, 'productName' | 'label'>): string {
  return sku.label ? `${sku.productName} (${sku.label})` : sku.productName
}

/**
 * Draft state for the sale form: pending SKU/quantity, merged lines, product
 * options with price/stock hints, stock caps (anticipated tandas) and the
 * running total. Stores are not touched here; the caller submits `items()`.
 */
export function useSaleDraft(options: {
  type: MaybeRefOrGetter<TandaType>
  catalog: MaybeRefOrGetter<CatalogGroup[]>
  /** Inventory of the tanda (ignored for scheduled tandas). */
  inventory: MaybeRefOrGetter<InventoryEntry[]>
  /** Pre-selected SKU (e.g. when launching the form from the inventory). */
  initialSkuId?: string
  /** Existing sale being edited; its lines prefill the draft. */
  initialSale?: SaleWithDetails
}) {
  const { initialSale } = options

  const selectedSkuId = ref(initialSale ? '' : (options.initialSkuId ?? ''))
  const quantity = ref(1)
  const lines = ref<DraftLine[]>(
    initialSale?.items.map((line) => ({
      skuId: line.skuId,
      label: line.label,
      price: line.unitPrice,
      quantity: line.quantity,
    })) ?? [],
  )
  const error = ref('')

  const limitedByStock = computed(() => tracksInventory({ type: toValue(options.type) }))
  const { availableOf } = useInventoryAvailability(() =>
    limitedByStock.value ? toValue(options.inventory) : [],
  )

  /** Stock the current draft may take for a SKU: batch availability plus what the
   *  sale being edited already holds (so it never fails against itself). */
  function stockLimitOf(skuId: string): number {
    const own = initialSale?.items.find((line) => line.skuId === skuId)?.quantity ?? 0
    return availableOf(skuId) + own
  }

  function quantityInLines(skuId: string): number {
    return lines.value
      .filter((line) => line.skuId === skuId)
      .reduce((sum, line) => sum + line.quantity, 0)
  }

  const skuOptions = computed<ComboOption[]>(() =>
    toValue(options.catalog).flatMap((group) =>
      group.skus.map((sku) => {
        const unavailable = limitedByStock.value && availableOf(sku.id) <= 0
        const unpriced = sku.price === null
        const price = sku.price ?? 0
        return {
          value: sku.id,
          label: sku.label ? `${group.product.name} (${sku.label})` : group.product.name,
          hint: unpriced
            ? 'no price'
            : unavailable
              ? `no stock · ${formatMoney(price)}`
              : `${formatMoney(price)} · ${availableOf(sku.id)} available`,
          disabled: unpriced || unavailable,
          disabledReason: unpriced ? 'No price set' : 'Out of stock',
        }
      }),
    ),
  )

  /** Remaining stock for the picked SKU once lines already added are accounted for. */
  const remainingForSelected = computed<number | null>(() => {
    if (!limitedByStock.value || !selectedSkuId.value) return null
    return stockLimitOf(selectedSkuId.value) - quantityInLines(selectedSkuId.value)
  })

  const canBumpQtyUp = computed(
    () => remainingForSelected.value === null || quantity.value < remainingForSelected.value,
  )

  const runningTotal = computed(() =>
    lines.value.reduce((sum, line) => sum + line.price * line.quantity, 0),
  )

  // Any edit to the pending line clears a stale error from the previous attempt.
  watch([selectedSkuId, quantity], () => {
    error.value = ''
  })

  /** Upper bound a line may reach: batch stock (plus the edit sale's own) or none. */
  function lineCap(line: DraftLine): number {
    return limitedByStock.value ? stockLimitOf(line.skuId) : Number.POSITIVE_INFINITY
  }

  function bumpQty(delta: number): void {
    const base = Number.isInteger(quantity.value) && quantity.value >= 1 ? quantity.value : 1
    const next = Math.max(1, base + delta)
    quantity.value =
      remainingForSelected.value === null
        ? next
        : Math.min(next, Math.max(remainingForSelected.value, 1))
  }

  /** Add the pending SKU/quantity as a line. Returns false (and sets `error`) when refused. */
  function addLine(): boolean {
    error.value = ''
    const sku = toValue(options.catalog)
      .flatMap((group) => group.skus)
      .find((s) => s.id === selectedSkuId.value)
    if (!sku) {
      error.value = 'Pick a product first.'
      return false
    }
    if (sku.price === null) {
      error.value = `"${sku.productName}" has no price set.`
      return false
    }
    const qty = quantity.value
    if (!Number.isInteger(qty) || qty < 1) {
      error.value = 'Quantity must be a whole number of at least 1.'
      return false
    }
    if (limitedByStock.value) {
      const alreadyInLines = quantityInLines(sku.id)
      const limit = stockLimitOf(sku.id)
      if (alreadyInLines + qty > limit) {
        error.value = `Only ${Math.max(limit - alreadyInLines, 0)} available for ${sku.label || sku.productName}.`
        return false
      }
    }
    const existing = lines.value.find((line) => line.skuId === sku.id)
    if (existing) {
      existing.quantity += qty
    } else {
      lines.value.push({ skuId: sku.id, label: lineLabel(sku), price: sku.price, quantity: qty })
    }
    selectedSkuId.value = ''
    quantity.value = 1
    return true
  }

  function bumpLine(line: DraftLine, delta: number): void {
    line.quantity = Math.min(Math.max(line.quantity + delta, 1), lineCap(line))
  }

  /** Set a line's quantity, clamped to its cap; invalid values are ignored. Returns the result. */
  function setLineQuantity(line: DraftLine, next: number): number {
    if (Number.isInteger(next) && next >= 1) {
      line.quantity = Math.min(next, lineCap(line))
    }
    return line.quantity
  }

  /** Remaining stock label for a line (anticipated tandas only). */
  function lineStockLabel(line: DraftLine): string | null {
    if (!limitedByStock.value) return null
    const left = Math.max(stockLimitOf(line.skuId) - line.quantity, 0)
    return left === 0 ? 'none left' : `${left} left`
  }

  function removeLine(skuId: string): void {
    lines.value = lines.value.filter((line) => line.skuId !== skuId)
  }

  function reset(): void {
    selectedSkuId.value = ''
    quantity.value = 1
    lines.value = []
    error.value = ''
  }

  /** Lines as repo input. */
  function items(): { skuId: string; quantity: number }[] {
    return lines.value.map((line) => ({ skuId: line.skuId, quantity: line.quantity }))
  }

  return {
    selectedSkuId,
    quantity,
    lines,
    error,
    skuOptions,
    remainingForSelected,
    canBumpQtyUp,
    runningTotal,
    stockLimitOf,
    lineCap,
    lineStockLabel,
    bumpQty,
    addLine,
    bumpLine,
    setLineQuantity,
    removeLine,
    reset,
    items,
  }
}
