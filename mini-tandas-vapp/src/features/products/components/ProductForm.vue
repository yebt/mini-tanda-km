<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { Product } from '@shared/db/types'

import ProductGeneralTab from './ProductGeneralTab.vue'
import ProductVariationsTab from './ProductVariationsTab.vue'

const props = defineProps<{
  /** The product being edited, or null when creating a new one. */
  initial: Product | null
}>()

const emit = defineEmits<{
  saved: [id: string]
  cancel: []
}>()

const store = useProductsStore()

type Tab = 'general' | 'variations'

const activeTab = ref<Tab>('general')
/** Id of the product currently held by the form (set on first save). */
const savedId = ref<string | null>(props.initial?.id ?? null)

watch(
  () => props.initial,
  (product) => {
    // After our own save the page feeds the new product back in — keep the
    // variations tab open instead of resetting.
    if (product?.id === savedId.value) return
    savedId.value = product?.id ?? null
    activeTab.value = 'general'
  },
)

const savedProduct = computed(
  () => store.catalog.find((entry) => entry.product.id === savedId.value)?.product ?? null,
)

function onSaved(id: string) {
  const isNew = savedId.value === null
  savedId.value = id
  // After the first save, jump to variations & pricing so they can be
  // managed right away — everything there applies immediately.
  if (isNew) activeTab.value = 'variations'
  emit('saved', id)
}
</script>

<template>
  <div class="card product-form">
    <h2>{{ savedId ? 'Edit product' : 'New product' }}</h2>

    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="tab"
        :class="{ active: activeTab === 'general' }"
        :aria-selected="activeTab === 'general'"
        @click="activeTab = 'general'"
      >
        General
      </button>
      <button
        type="button"
        role="tab"
        class="tab"
        :class="{ active: activeTab === 'variations' }"
        :aria-selected="activeTab === 'variations'"
        @click="activeTab = 'variations'"
      >
        Variations &amp; pricing
      </button>
    </div>

    <ProductGeneralTab
      v-if="activeTab === 'general'"
      :initial="initial"
      @saved="onSaved"
      @cancel="emit('cancel')"
    />
    <ProductVariationsTab v-else :product="savedProduct" />
  </div>
</template>

<style scoped>
.product-form {
  max-width: 640px;
}

.tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-4);
}

.tab {
  border: none;
  background: transparent;
  padding: var(--space-2) var(--space-3);
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-ink-soft);
  cursor: pointer;
}

.tab:hover {
  color: var(--color-primary);
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
</style>
