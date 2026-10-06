import { computed } from 'vue'
import { defineStore } from 'pinia'

import { dbVersion } from '@shared/db/database'
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
  // Reading dbVersion keeps these computeds re-evaluating after every write.
  const products = computed<Product[]>(() => {
    void dbVersion.value
    return listProducts()
  })

  const skus = computed<SkuWithProduct[]>(() => {
    // Reuses the loaded products instead of querying them a second time.
    return listSkusWithProducts(products.value)
  })

  const priceRows = computed<PriceRow[]>(() => {
    void dbVersion.value
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
