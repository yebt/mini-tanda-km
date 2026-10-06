<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { Product } from '@shared/db/types'
import TabList, { panelId, tabId } from '@shared/ui/TabList.vue'

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

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'variations', label: 'Variations & pricing' },
] as const

function onTabChange(value: string) {
  activeTab.value = value === 'variations' ? 'variations' : 'general'
}

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
    <div class="row-between form-head">
      <h2>{{ savedId ? 'Edit product' : 'New product' }}</h2>
      <!-- Always-visible exit once the product exists (variations apply instantly). -->
      <button v-if="savedId" type="button" class="btn" @click="emit('cancel')">Done</button>
    </div>

    <TabList
      :tabs="TABS"
      :model-value="activeTab"
      id-base="product"
      label="Product sections"
      @update:model-value="onTabChange"
    />

    <div
      :id="panelId('product', activeTab)"
      role="tabpanel"
      :aria-labelledby="tabId('product', activeTab)"
    >
      <ProductGeneralTab
        v-if="activeTab === 'general'"
        :initial="initial"
        @saved="onSaved"
        @cancel="emit('cancel')"
      />
      <ProductVariationsTab v-else :product="savedProduct" />
    </div>
  </div>
</template>

<style scoped>
.product-form {
  max-width: 640px;
}

.form-head {
  margin-bottom: var(--space-3);
}

.form-head h2 {
  margin-bottom: 0;
}
</style>
