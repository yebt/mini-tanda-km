<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'

import { confirmDialog } from '@shared/ui/useConfirm'
import { notify } from '@shared/ui/useToast'
import { whenIdle } from '@shared/ui/whenIdle'
import { prefetchRoute } from '@core/router/prefetch'
import { useProductsStore } from '@shared/stores/products'
import type { Product } from '@shared/db/types'

import ProductList from '@/features/products/components/ProductList.vue'

const NEW_PRODUCT_PATH = '/products/new'

const store = useProductsStore()
const router = useRouter()

// The editor has its own route: warm its code once the list is on screen.
onMounted(() => whenIdle(() => void prefetchRoute(router, NEW_PRODUCT_PATH)))

const removeError = ref('')

function openEdit(product: Product) {
  void router.push(`/products/${product.id}`)
}

async function onRemove(product: Product) {
  // Say why up front instead of confirming an action that cannot happen.
  const blocker = store.removalBlocker(product.id)
  if (blocker) {
    removeError.value = blocker
    return
  }
  removeError.value = ''
  const ok = await confirmDialog(
    `Delete "${product.name}" with its variations and prices? This cannot be undone.`,
    'Delete product',
    { tone: 'danger' },
  )
  if (!ok) return
  const result = store.removeProduct(product.id)
  removeError.value = result.ok ? '' : result.error
  if (result.ok) notify(`"${product.name}" deleted.`)
}
</script>

<template>
  <div class="row-between page-header">
    <h1>Products</h1>
    <RouterLink :to="NEW_PRODUCT_PATH" class="btn btn-primary desktop-only">New product</RouterLink>
  </div>

  <p v-if="removeError" class="error-text" role="alert">{{ removeError }}</p>
  <p v-if="store.catalog.length === 0" class="card empty-state">
    No products yet — create your first product.
  </p>
  <ProductList v-else :items="store.catalog" @edit="openEdit" @remove="onRemove" />

  <RouterLink :to="NEW_PRODUCT_PATH" class="fab mobile-only" aria-label="New product">
    <Plus class="fab-icon" :size="26" :stroke-width="2.25" aria-hidden="true" />
  </RouterLink>
</template>

<style scoped>
.empty-state {
  display: block;
}
</style>
