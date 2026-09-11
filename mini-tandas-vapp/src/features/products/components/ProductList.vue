<script setup lang="ts">
import { computed } from 'vue'

import type { PriceRow, Product, SkuWithProduct } from '@shared/db/types'

import { summarizePricing, summarizeVariations } from '../lib/productPricing'
import ProductCard from './ProductCard.vue'
import ActionMenu from './ActionMenu.vue'

const props = defineProps<{
  items: { product: Product; skus: SkuWithProduct[]; priceRows: PriceRow[] }[]
}>()

const emit = defineEmits<{
  edit: [product: Product]
  remove: [product: Product]
}>()

interface Row {
  product: Product
  initial: string
  priceModeLabel: string
  priceModeClass: string
  priceHeading: string
  priceDetail: string
  variationSummary: string
}

const rows = computed<Row[]>(() =>
  props.items.map(({ product, priceRows }) => {
    const pricing = summarizePricing(product, priceRows)
    return {
      product,
      initial: product.name.charAt(0).toUpperCase(),
      priceModeLabel: product.priceMode === 'global' ? 'Global price' : 'Price per SKU',
      priceModeClass: product.priceMode === 'global' ? 'badge-info' : 'badge-neutral',
      priceHeading: pricing.heading,
      priceDetail: pricing.detail,
      variationSummary: summarizeVariations(product),
    }
  }),
)
</script>

<template>
  <div class="card table-card desktop-only">
    <table class="table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Price</th>
          <th>Variations</th>
          <th class="actions-col" aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.product.id">
          <td>
            <div class="cell-product">
              <div class="product-photo" :class="{ 'has-photo': row.product.photo }">
                <img v-if="row.product.photo" :src="row.product.photo" :alt="row.product.name" />
                <span v-else>{{ row.initial }}</span>
              </div>
              <div class="cell-text">
                <strong>{{ row.product.name }}</strong>
                <p v-if="row.product.description" class="muted cell-description">
                  {{ row.product.description }}
                </p>
              </div>
            </div>
          </td>
          <td>
            <span class="badge" :class="row.priceModeClass">{{ row.priceModeLabel }}</span>
            <p class="money cell-price">{{ row.priceHeading }}</p>
            <p v-if="row.priceDetail" class="muted cell-detail">{{ row.priceDetail }}</p>
          </td>
          <td>
            <span v-if="row.variationSummary">{{ row.variationSummary }}</span>
            <span v-else class="muted">No variations</span>
          </td>
          <td class="actions-col">
            <ActionMenu @edit="emit('edit', row.product)" @remove="emit('remove', row.product)" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="product-list mobile-only">
    <ProductCard
      v-for="item in items"
      :key="item.product.id"
      :product="item.product"
      :price-rows="item.priceRows"
      @edit="emit('edit', $event)"
      @remove="emit('remove', $event)"
    />
  </div>
</template>

<style scoped>
.table-card {
  padding: var(--space-3) var(--space-4);
}

.actions-col {
  width: 48px;
  text-align: right;
}

.cell-product {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cell-text {
  min-width: 0;
}

.cell-description {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.cell-price {
  margin: var(--space-1) 0 0;
}

.cell-detail {
  margin: 0;
  font-size: 0.8rem;
}

tbody td {
  transition: background-color 140ms ease-out;
}

tbody tr:hover td {
  background: var(--color-bg);
}

tbody tr:last-child td {
  border-bottom: none;
}

@media (prefers-reduced-motion: reduce) {
  tbody td {
    transition: none;
  }
}

.product-photo {
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-small);
  border: 1px solid var(--color-border);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
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

.product-list {
  display: grid;
  /* minmax(0, …) so long price rows can't push the track past the viewport */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-3);
}
</style>
