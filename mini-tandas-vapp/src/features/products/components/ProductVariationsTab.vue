<script setup lang="ts">
import { computed } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { Product } from '@shared/db/types'

import VariationEditor from './VariationEditor.vue'
import PricingSection from './PricingSection.vue'

const props = defineProps<{
  /** Saved product, or null while the product has not been created yet. */
  product: Product | null
}>()

const store = useProductsStore()

const priceRows = computed(() =>
  store.priceRows.filter((row) => row.productId === props.product?.id),
)
</script>

<template>
  <p v-if="!product" class="muted save-first">Save the product first to manage variations.</p>
  <template v-else>
    <p class="muted autosave-note">Changes here save automatically.</p>
    <VariationEditor :product="product" />
    <template v-if="product.priceMode === 'per_sku'">
      <hr class="divider" />
      <PricingSection :product="product" :price-rows="priceRows" />
    </template>
    <p v-else class="muted sku-note">SKUs sell at the global product price.</p>
  </template>
</template>

<style scoped>
.save-first {
  margin: 0;
}

.autosave-note {
  margin: 0 0 var(--space-3);
}

.divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-6) 0;
}

.sku-note {
  margin-bottom: 0;
}
</style>
