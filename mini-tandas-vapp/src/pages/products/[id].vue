<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import ProductEditor from '@/features/products/components/ProductEditor.vue'

const route = useRoute()

/** `/products/:id`; `/products/new` is its own page and never reaches here. */
const productId = computed(() => {
  const id = (route.params as { id?: string | string[] }).id
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '')
})
</script>

<template>
  <ProductEditor :key="productId" :product-id="productId" />
</template>
