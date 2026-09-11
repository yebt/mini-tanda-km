<script setup lang="ts">
import { computed } from 'vue'

import { formatMoney } from '@shared/db/format'
import type { PriceRow, Product } from '@shared/db/types'

import ActionMenu from '@shared/ui/ActionMenu.vue'

import { summarizePricing } from '../lib/productPricing'

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

const isGlobalMode = computed(() => props.product.priceMode === 'global')

const priceSet = computed(() =>
  isGlobalMode.value
    ? pricing.value.hasPrices
    : pricing.value.hasPrices && pricing.value.minPrice != null,
)

const priceLead = computed(() => (!isGlobalMode.value && priceSet.value ? 'From' : ''))

const priceAmount = computed(() => {
  if (isGlobalMode.value) return pricing.value.heading
  return pricing.value.minPrice != null ? formatMoney(pricing.value.minPrice) : 'No prices'
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
    <div class="product-photo">
      <img v-if="product.photo" :src="product.photo" :alt="product.name" />
      <span v-else>{{ initial }}</span>
    </div>
    <div class="product-body">
      <div class="row-between product-head">
        <h3 class="product-name">{{ product.name }}</h3>
        <ActionMenu @edit="emit('edit', product)" @remove="emit('remove', product)" />
      </div>
      <div class="price-block">
        <p class="price-line" :class="{ 'is-unset': !priceSet }">
          <span v-if="priceLead" class="price-lead">{{ priceLead }}</span>
          <span class="money price-amount">{{ priceAmount }}</span>
        </p>
        <div class="card-meta">
          <span class="badge" :class="modeClass">{{ modeLabel }}</span>
          <span v-if="priceDetail" class="muted">{{ priceDetail }}</span>
        </div>
      </div>
      <p v-if="product.description" class="muted product-description">{{ product.description }}</p>
      <div v-if="variationBadges.length" class="variations">
        <span v-for="variation in variationBadges" :key="variation.id" class="variation-chip">
          <span class="variation-head">
            <span class="variation-name">{{ variation.name }}</span>
            <span class="variation-count">{{ variation.count }}</span>
          </span>
          <span class="variation-options">{{
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
  min-width: 0;
}

.product-photo {
  flex: 0 0 64px;
  width: 64px;
  height: 64px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  overflow: hidden;
}

.product-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.product-name {
  margin-bottom: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.price-block {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-2);
  min-width: 0;
}

.price-line {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1);
  margin: 0;
}

.price-lead {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-ink-soft);
}

.price-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}

.price-line.is-unset .price-amount {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-ink-soft);
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}

.product-description {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.variations {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.variation-chip {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
  overflow: hidden;
  padding: 0.2rem var(--space-2);
  background: var(--color-bg);
  border-radius: var(--radius-small);
}

.variation-head {
  flex-shrink: 0;
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1);
}

.variation-name {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-ink-soft);
}

.variation-count {
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-primary);
}

.variation-options {
  flex: 1 1 auto;
  min-width: 0;
  border-left: 1px solid var(--color-border);
  padding-left: var(--space-2);
  font-size: 0.8rem;
  color: var(--color-ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (min-width: 721px) {
  .product-card {
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .product-card:hover,
  .product-card:focus-within {
    border-color: var(--color-primary);
    box-shadow:
      0 2px 4px rgb(43 33 24 / 8%),
      0 10px 24px rgb(43 33 24 / 10%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .product-card {
    transition: none;
  }
}
</style>
