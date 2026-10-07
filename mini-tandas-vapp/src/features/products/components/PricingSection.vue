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

function isPricing(variation: Variation): boolean {
  return pricingVariations.value.some((candidate) => candidate.id === variation.id)
}

function optionCount(variation: Variation): string {
  const count = variation.options.length
  return `${count} ${count === 1 ? 'option' : 'options'}`
}

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
    <p class="muted pricing-intro">
      Choose the variations that change the price. Each combination of their options gets one
      price.
    </p>

    <fieldset v-if="product.variations.length" class="choice-group depends-on">
      <legend class="label">Price depends on</legend>
      <div class="choice-grid choice-grid-compact">
        <label v-for="variation in product.variations" :key="variation.id" class="choice-card">
          <input
            type="checkbox"
            class="choice-input"
            :checked="isPricing(variation)"
            :aria-labelledby="`price-var-${variation.id}-title`"
            :aria-describedby="`price-var-${variation.id}-desc`"
            @change="togglePricingVariation(variation, $event)"
          />
          <span class="choice-text">
            <span :id="`price-var-${variation.id}-title`" class="choice-title">
              {{ variation.name }}
            </span>
            <span :id="`price-var-${variation.id}-desc`" class="choice-desc">
              {{ optionCount(variation) }}
            </span>
          </span>
        </label>
      </div>
    </fieldset>

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

.pricing-intro {
  margin: 0 0 var(--space-4);
  max-width: 60ch;
}

.depends-on {
  margin-bottom: var(--space-4);
}

.pricing-section > p:last-child {
  margin-bottom: 0;
}
</style>
