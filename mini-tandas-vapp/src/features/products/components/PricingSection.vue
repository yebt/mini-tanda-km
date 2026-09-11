<script setup lang="ts">
import { computed } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { PriceRow, Product, Variation } from '@shared/db/types'

import { pricingVariationsOf } from '../lib/productPricing'
import PriceTable from './PriceTable.vue'

const props = defineProps<{
  /** Saved product — pricing requires a persisted id. */
  product: Product
  priceRows: PriceRow[]
}>()

const store = useProductsStore()

const pricingVariations = computed(() => pricingVariationsOf(props.product))

function togglePricingVariation(variation: Variation, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const selected = new Set(props.product.priceVariationIds)
  if (checked) selected.add(variation.id)
  else selected.delete(variation.id)
  const next = props.product.variations
    .filter((candidate) => selected.has(candidate.id))
    .map((candidate) => candidate.id)
  store.setPricingVariations(props.product.id, next)
}
</script>

<template>
  <section class="pricing-section">
    <h3>Pricing</h3>
    <p class="muted">
      Pick which variations drive the price — e.g. only SIZE, or SIZE + PACKAGING. Every option
      combination of the chosen variations gets one price.
    </p>

    <div v-if="product.variations.length" class="depends-on">
      <span class="label">Price depends on:</span>
      <label v-for="variation in product.variations" :key="variation.id" class="check-option">
        <input
          type="checkbox"
          :checked="pricingVariations.some((candidate) => candidate.id === variation.id)"
          @change="togglePricingVariation(variation, $event)"
        />
        <span>
          {{ variation.name }}
          <span class="muted">({{ variation.options.length }} options)</span>
        </span>
      </label>
    </div>

    <template v-if="pricingVariations.length">
      <PriceTable :product="product" :price-rows="priceRows" />
    </template>
    <p v-else-if="product.variations.length" class="muted">
      Select which variations set the price.
    </p>
    <p v-else class="muted">Add a variation first, then choose which variations set the price.</p>
  </section>
</template>

<style scoped>
.pricing-section h3 {
  margin-top: 0;
}

.depends-on {
  margin-bottom: var(--space-4);
}

.check-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  cursor: pointer;
  text-transform: capitalize;
}

.pricing-section > p:last-child {
  margin-bottom: 0;
}
</style>
