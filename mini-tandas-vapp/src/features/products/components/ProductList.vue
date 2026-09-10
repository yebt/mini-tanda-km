<script setup lang="ts">
import type { Product, SkuWithProduct } from '@shared/db/types'

import ProductCard from './ProductCard.vue'

defineProps<{
  items: { product: Product; skus: SkuWithProduct[] }[]
}>()

const emit = defineEmits<{
  edit: [product: Product]
  remove: [product: Product]
}>()
</script>

<template>
  <div class="product-list">
    <ProductCard
      v-for="item in items"
      :key="item.product.id"
      :product="item.product"
      :skus="item.skus"
      @edit="emit('edit', $event)"
      @remove="emit('remove', $event)"
    />
  </div>
</template>

<style scoped>
.product-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}
</style>
