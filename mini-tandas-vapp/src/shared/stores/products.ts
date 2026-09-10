import { computed } from 'vue'
import { defineStore } from 'pinia'

import { dbVersion } from '@shared/db/database'
import {
  addOption,
  addVariation,
  createProduct,
  deleteProduct,
  listProducts,
  listSkusWithProducts,
  productInUse,
  removeOption,
  removeVariation,
  setSkuPrice,
  updateProduct,
  type ProductInput,
} from '@shared/db/repos/products'
import type { Product, SkuWithProduct } from '@shared/db/types'

export const useProductsStore = defineStore('products', () => {
  // Reading dbVersion keeps these computeds re-evaluating after every write.
  const products = computed<Product[]>(() => {
    void dbVersion.value
    return listProducts()
  })

  const skus = computed<SkuWithProduct[]>(() => {
    void dbVersion.value
    return listSkusWithProducts()
  })

  const catalog = computed(() =>
    products.value.map((product) => ({
      product,
      skus: skus.value.filter((sku) => sku.productId === product.id),
    })),
  )

  function saveProduct(input: ProductInput & { id?: string }): string {
    if (input.id) {
      updateProduct(input.id, input)
      return input.id
    }
    return createProduct(input)
  }

  function removeProduct(id: string): { ok: true } | { ok: false; error: string } {
    if (productInUse(id)) {
      return {
        ok: false,
        error: 'This product already has sales or inventory — it cannot be deleted.',
      }
    }
    deleteProduct(id)
    return { ok: true }
  }

  return {
    products,
    skus,
    catalog,
    saveProduct,
    removeProduct,
    addVariation,
    removeVariation,
    addOption,
    removeOption,
    setSkuPrice,
  }
})
