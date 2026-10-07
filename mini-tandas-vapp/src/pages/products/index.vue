<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'

import { confirmDialog } from '@shared/ui/useConfirm'
import { notify } from '@shared/ui/useToast'
import { whenIdle } from '@shared/ui/whenIdle'
import { useProductsStore } from '@shared/stores/products'
import type { Product } from '@shared/db/types'

import ProductList from '@/features/products/components/ProductList.vue'

const loadProductForm = () => import('@/features/products/components/ProductForm.vue')
/** The editor is not needed to show the list: load its code on demand. */
const ProductForm = defineAsyncComponent(loadProductForm)

const store = useProductsStore()

// Warm the editor chunk once the list is on screen and the browser is idle.
onMounted(() => whenIdle(() => void loadProductForm().catch(() => {})))

const formOpen = ref(false)
const editingId = ref<string | null>(null)
const removeError = ref('')

const editingProduct = computed(
  () => store.catalog.find((entry) => entry.product.id === editingId.value)?.product ?? null,
)

function openNew() {
  editingId.value = null
  removeError.value = ''
  formOpen.value = true
}

function openEdit(product: Product) {
  editingId.value = product.id
  removeError.value = ''
  formOpen.value = true
}

function onSaved(id: string) {
  // Stay in the form so variations / SKU prices can be edited right away.
  editingId.value = id
}

function onCancel() {
  formOpen.value = false
  editingId.value = null
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
  if (result.ok && editingId.value === product.id) {
    formOpen.value = false
    editingId.value = null
  }
}
</script>

<template>
  <div class="row-between page-header">
    <h1>Products</h1>
    <button v-if="!formOpen" type="button" class="btn btn-primary desktop-only" @click="openNew">
      New product
    </button>
  </div>

  <ProductForm v-if="formOpen" :initial="editingProduct" @saved="onSaved" @cancel="onCancel" />

  <template v-else>
    <p v-if="removeError" class="error-text" role="alert">{{ removeError }}</p>
    <p v-if="store.catalog.length === 0" class="card empty-state">
      No products yet — create your first product.
    </p>
    <ProductList v-else :items="store.catalog" @edit="openEdit" @remove="onRemove" />
  </template>

  <button
    v-if="!formOpen"
    type="button"
    class="fab mobile-only"
    aria-label="New product"
    @click="openNew"
  >
    <Plus class="fab-icon" :size="26" :stroke-width="2.25" aria-hidden="true" />
  </button>
</template>

<style scoped>
.empty-state {
  display: block;
}
</style>
