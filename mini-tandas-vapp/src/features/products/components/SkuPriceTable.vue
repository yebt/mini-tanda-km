<script setup lang="ts">
import { ref, watch } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { SkuWithProduct } from '@shared/db/types'

const props = defineProps<{
  skus: SkuWithProduct[]
}>()

const store = useProductsStore()

const drafts = ref<Record<string, string>>({})

watch(
  () => props.skus.map((sku) => `${sku.id}:${sku.price ?? ''}`).join('|'),
  () => {
    const next: Record<string, string> = {}
    for (const sku of props.skus) next[sku.id] = sku.price == null ? '' : String(sku.price)
    drafts.value = next
  },
  { immediate: true },
)

function commit(sku: SkuWithProduct) {
  const raw = (drafts.value[sku.id] ?? '').trim()
  const parsed = raw === '' ? null : Number(raw)
  store.setSkuPrice(
    sku.id,
    parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
  )
}
</script>

<template>
  <div class="sku-table">
    <h4 class="sku-title">SKU prices</h4>
    <table v-if="skus.length" class="table">
      <thead>
        <tr>
          <th>SKU</th>
          <th class="price-col">Price</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="sku in skus" :key="sku.id">
          <td>{{ sku.label }}</td>
          <td class="price-col">
            <input
              v-model="drafts[sku.id]"
              type="number"
              min="0"
              step="0.01"
              class="input price-input"
              placeholder="—"
              @change="commit(sku)"
            />
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted">No SKUs yet — add variation options above to generate them.</p>
  </div>
</template>

<style scoped>
.sku-title {
  margin: var(--space-4) 0 var(--space-2);
}

.price-col {
  width: 160px;
}

.price-input {
  text-align: right;
}
</style>
