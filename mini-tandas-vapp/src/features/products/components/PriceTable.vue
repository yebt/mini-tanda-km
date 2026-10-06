<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { PriceRow, Product } from '@shared/db/types'

import { comboKey, comboLabel, pricingCombos } from '../lib/productPricing'

const props = defineProps<{
  /** Saved product — price rows require a persisted id. */
  product: Product
  priceRows: PriceRow[]
}>()

const store = useProductsStore()

const rowsByKey = computed(() => {
  const map = new Map<string, number>()
  for (const row of props.priceRows) map.set(comboKey(row.optionIds), row.price)
  return map
})

const tableRows = computed(() =>
  pricingCombos(props.product).map((combo) => {
    const key = comboKey(combo)
    return {
      key,
      label: comboLabel(props.product, combo),
      price: rowsByKey.value.get(key) ?? null,
    }
  }),
)

// Editable drafts keyed by combination. `v-model` on a number input may
// hand back a number, so drafts accept `string | number` and are normalized
// on commit.
const drafts = ref<Record<string, string | number>>({})

watch(
  () =>
    [
      props.product.id,
      tableRows.value.map((row) => row.key).join('|'),
      props.priceRows.map((row) => `${comboKey(row.optionIds)}=${row.price}`).join('|'),
    ].join('::'),
  () => {
    const next: Record<string, string | number> = {}
    for (const row of tableRows.value) {
      next[row.key] = row.price == null ? '' : String(row.price)
    }
    drafts.value = next
  },
  { immediate: true },
)

function commit(key: string) {
  const raw = drafts.value[key]
  const text = typeof raw === 'number' ? String(raw) : (raw ?? '').trim()
  const parsed = text === '' ? null : Number(text)
  const price = parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null
  if ((rowsByKey.value.get(key) ?? null) === price) return
  store.setPriceRow(props.product.id, JSON.parse(key) as string[], price)
}
</script>

<template>
  <table class="price-table table">
    <thead>
      <tr>
        <th>Option</th>
        <th class="price-col">Price</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in tableRows" :key="row.key" :class="{ unpriced: row.price == null }">
        <td>{{ row.label }}</td>
        <td class="price-col">
          <input
            v-model="drafts[row.key]"
            type="number"
            min="0"
            step="0.01"
            class="input price-input"
            placeholder="—"
            :aria-label="`Price for ${row.label}`"
            @change="commit(row.key)"
            @blur="commit(row.key)"
          />
          <p v-if="row.price == null" class="muted no-price">No price</p>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.price-col {
  width: 180px;
}

.price-input {
  text-align: right;
}

.no-price {
  margin: var(--space-1) 0 0;
  font-size: 0.78rem;
}

tr.unpriced td {
  background: var(--color-bg);
}
</style>
