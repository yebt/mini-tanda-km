<script setup lang="ts">
import { computed } from 'vue'

import { formatMoney } from '@shared/db/format'
import type { PriceRow, Product } from '@shared/db/types'

import { summarizePricing } from '../lib/productPricing'
import ActionMenu from './ActionMenu.vue'

const props = defineProps<{
  product: Product
  priceRows: PriceRow[]
}>()

const emit = defineEmits<{
  edit: [product: Product]
  remove: [product: Product]
}>()

const initial = computed(() => props.product.name.charAt(0).toUpperCase())

const modeLabel = computed(() =>
  props.product.priceMode === 'global' ? 'Global price' : 'Price per SKU',
)

const modeClass = computed(() =>
  props.product.priceMode === 'global' ? 'badge-info' : 'badge-neutral',
)

const pricing = computed(() => summarizePricing(props.product, props.priceRows))

const priceSummary = computed(() => {
  if (props.product.priceMode === 'global') return pricing.value.heading
  return pricing.value.hasPrices && pricing.value.minPrice != null
    ? `From ${formatMoney(pricing.value.minPrice)}`
    : 'No prices'
})

const priceDetail = computed(() =>
  props.product.priceMode === 'per_sku' && pricing.value.comboCount > 0 ? pricing.value.detail : '',
)

const variationBadges = computed(() =>
  props.product.variations.map((variation) => ({
    id: variation.id,
    name: variation.name,
    count: variation.options.length,
    summary: variation.options.map((option) => option.label).join(', '),
  })),
)
</script>

<template>
  <article class="card product-card">
    <div class="product-photo" :class="{ 'has-photo': product.photo }">
      <img v-if="product.photo" :src="product.photo" :alt="product.name" />
      <span v-else>{{ initial }}</span>
    </div>
    <div class="product-body">
      <div class="row-between">
        <h3 class="product-name">{{ product.name }}</h3>
        <ActionMenu @edit="emit('edit', product)" @remove="emit('remove', product)" />
      </div>
      <div class="row-wrap card-meta">
        <span class="badge" :class="modeClass">{{ modeLabel }}</span>
        <span class="money">{{ priceSummary }}</span>
        <span v-if="priceDetail" class="muted">{{ priceDetail }}</span>
      </div>
      <p v-if="product.description" class="muted product-description">{{ product.description }}</p>
      <div v-if="variationBadges.length" class="row-wrap">
        <span v-for="variation in variationBadges" :key="variation.id" class="variation-chip">
          <strong>{{ variation.name }}</strong>
          <span class="muted">{{
            variation.count > 0 ? variation.summary : 'no options yet'
          }}</span>
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.product-card {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin-bottom: 0;
  padding: var(--space-4);
}

.product-photo {
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 700;
  overflow: hidden;
}

.product-photo.has-photo {
  border: none;
}

.product-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-body {
  flex: 1;
  min-width: 0;
}

.product-name {
  margin-bottom: 0;
}

.card-meta {
  margin-top: var(--space-2);
  align-items: baseline;
}

.product-description {
  margin: var(--space-2) 0 0;
}

.variation-chip {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1);
  padding: 0.15rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.8rem;
  margin-top: var(--space-2);
}
</style>
