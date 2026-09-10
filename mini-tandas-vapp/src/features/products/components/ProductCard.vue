<script setup lang="ts">
import { computed } from 'vue'

import { formatMoney } from '@shared/db/format'
import type { Product, SkuWithProduct } from '@shared/db/types'

const props = defineProps<{
  product: Product
  skus: SkuWithProduct[]
}>()

const emit = defineEmits<{
  edit: [product: Product]
  remove: [product: Product]
}>()

const priceSummary = computed(() => {
  if (props.product.priceMode === 'global') {
    return props.product.price != null ? formatMoney(props.product.price) : 'No price set'
  }
  if (props.skus.length === 0) return 'Add variations to set SKU prices'
  const priced = props.skus.filter((sku) => sku.price != null).length
  return `Per SKU — ${priced} of ${props.skus.length} priced`
})

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
      <span v-else>{{ product.name.charAt(0).toUpperCase() }}</span>
    </div>
    <div class="product-body">
      <div class="row-between">
        <h3 class="product-name">{{ product.name }}</h3>
        <span
          class="badge"
          :class="product.priceMode === 'global' ? 'badge-info' : 'badge-neutral'"
        >
          {{ product.priceMode === 'global' ? 'Global price' : 'Price per SKU' }}
        </span>
      </div>
      <p v-if="product.description" class="muted product-description">{{ product.description }}</p>
      <p class="money">{{ priceSummary }}</p>
      <div v-if="variationBadges.length" class="row-wrap">
        <span v-for="variation in variationBadges" :key="variation.id" class="variation-chip">
          <strong>{{ variation.name }}</strong>
          <span class="muted">{{
            variation.count > 0 ? variation.summary : 'no options yet'
          }}</span>
        </span>
      </div>
      <div class="row product-actions">
        <button type="button" class="btn" @click="emit('edit', product)">Edit</button>
        <button type="button" class="btn btn-danger" @click="emit('remove', product)">
          Delete
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.product-card {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  margin-bottom: 0;
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
  margin-bottom: var(--space-1);
}

.product-description {
  margin: 0 0 var(--space-1);
}

.variation-chip {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1);
  padding: 0.15rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.8rem;
}

.product-actions {
  margin-top: var(--space-3);
}
</style>
