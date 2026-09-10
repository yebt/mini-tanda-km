<script setup lang="ts">
import { computed, ref } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { Product } from '@shared/db/types'

import ProductForm from '@/features/products/components/ProductForm.vue'
import ProductList from '@/features/products/components/ProductList.vue'

const store = useProductsStore()

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

function onRemove(product: Product) {
  if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
  const result = store.removeProduct(product.id)
  removeError.value = result.ok ? '' : result.error
  if (result.ok && editingId.value === product.id) {
    formOpen.value = false
    editingId.value = null
  }
}
</script>

<template>
  <div class="row-between page-header">
    <h1>Products</h1>
    <button v-if="!formOpen" type="button" class="btn btn-primary" @click="openNew">
      New product
    </button>
  </div>

  <ProductForm v-if="formOpen" :initial="editingProduct" @saved="onSaved" @cancel="onCancel" />

  <template v-else>
    <p v-if="removeError" class="error-text">{{ removeError }}</p>
    <p v-if="store.catalog.length === 0" class="card empty-state">
      No products yet — create your first product.
    </p>
    <ProductList v-else :items="store.catalog" @edit="openEdit" @remove="onRemove" />
  </template>
</template>

<style scoped>
.page-header {
  margin-bottom: var(--space-4);
}

.page-header h1 {
  margin-bottom: 0;
}

.empty-state {
  display: block;
}
</style>
