import { computed } from 'vue'
import { defineStore } from 'pinia'

import { track } from '@shared/db/database'
import {
  addOption,
  addVariation,
  createProduct,
  deleteProduct,
  getProductPhoto,
  listPriceRows,
  listProducts,
  listSkusWithProducts,
  productInUse,
  removeOption,
  removeVariation,
  setPriceRow,
  setPricingVariations,
  updateProduct,
  type ProductInput,
} from '@shared/db/repos/products'
import type { PriceRow, Product, SkuWithProduct } from '@shared/db/types'

export const useProductsStore = defineStore('products', () => {
  // Everything here reads catalog tables only: re-run after product writes.
  const products = computed<Product[]>(() => {
    track('products')
    return listProducts()
  })

  const skus = computed<SkuWithProduct[]>(() => {
    track('products')
    // Reuses the loaded products instead of querying them a second time.
    return listSkusWithProducts(products.value)
  })

  const priceRows = computed<PriceRow[]>(() => {
    track('products')
    return listPriceRows()
  })

  const catalog = computed(() =>
    products.value.map((product) => ({
      product,
      skus: skus.value.filter((sku) => sku.productId === product.id),
      priceRows: priceRows.value.filter((row) => row.productId === product.id),
    })),
  )

  function saveProduct(input: ProductInput & { id?: string }): string {
    if (input.id) {
      updateProduct(input.id, input)
      return input.id
    }
    return createProduct(input)
  }

  /** Full-size photo for the editor (lists use `product.thumbnail`). */
  function photoFor(id: string): string | null {
    return getProductPhoto(id)
  }

  /** Why a product cannot be deleted (checked before asking to confirm), or null. */
  function removalBlocker(id: string): string | null {
    return productInUse(id)
      ? 'This product already has sales or inventory — it cannot be deleted.'
      : null
  }

  function removeProduct(id: string): { ok: true } | { ok: false; error: string } {
    const blocker = removalBlocker(id)
    if (blocker) return { ok: false, error: blocker }
    deleteProduct(id)
    return { ok: true }
  }

  return {
    products,
    skus,
    priceRows,
    catalog,
    saveProduct,
    photoFor,
    removalBlocker,
    removeProduct,
    addVariation,
    removeVariation,
    addOption,
    removeOption,
    setPriceRow,
    setPricingVariations,
  }
})
