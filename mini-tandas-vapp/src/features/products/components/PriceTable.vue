<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

import { formatMoney } from '@shared/db/format'
import { parseMoneyInput } from '@shared/db/money'
import { useProductsStore } from '@shared/stores/products'
import type { PriceRow, Product } from '@shared/db/types'
import { notify } from '@shared/ui/useToast'

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

// Editable text drafts keyed by combination, normalized on commit.
const drafts = ref<Record<string, string>>({})
/** Inline validation message per combination (same rule as the General tab). */
const errors = ref<Record<string, string>>({})
const idBase = useId()
const errorId = (index: number) => `${idBase}-error-${index}`

watch(
  () =>
    [
      props.product.id,
      tableRows.value.map((row) => row.key).join('|'),
      props.priceRows.map((row) => `${comboKey(row.optionIds)}=${row.price}`).join('|'),
    ].join('::'),
  () => {
    const next: Record<string, string> = {}
    for (const row of tableRows.value) {
      next[row.key] = row.price == null ? '' : String(row.price)
    }
    drafts.value = next
    errors.value = {}
  },
  { immediate: true },
)

function commit(key: string, label: string) {
  const price = parseMoneyInput(drafts.value[key] ?? '')
  if (price !== null && Number.isNaN(price)) {
    // Keep what was typed and say why, instead of silently dropping it.
    errors.value = { ...errors.value, [key]: 'Enter a valid price (0 or more), or leave it empty.' }
    return
  }
  if (key in errors.value) {
    const next = { ...errors.value }
    delete next[key]
    errors.value = next
  }
  if ((rowsByKey.value.get(key) ?? null) === price) return
  store.setPriceRow(props.product.id, JSON.parse(key) as string[], price)
  notify(price === null ? `Price for ${label} cleared.` : `${label}: ${formatMoney(price)} saved.`)
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
      <tr
        v-for="(row, index) in tableRows"
        :key="row.key"
        :class="{ unpriced: row.price == null }"
      >
        <td>{{ row.label }}</td>
        <td class="price-col">
          <input
            v-model="drafts[row.key]"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            class="input price-input"
            placeholder="e.g. 90.00…"
            :aria-label="`Price for ${row.label}`"
            :aria-invalid="errors[row.key] ? 'true' : undefined"
            :aria-describedby="errors[row.key] ? errorId(index) : undefined"
            @change="commit(row.key, row.label)"
            @blur="commit(row.key, row.label)"
          />
          <p v-if="errors[row.key]" :id="errorId(index)" class="error-text" role="alert">
            {{ errors[row.key] }}
          </p>
          <p v-else-if="row.price == null" class="muted no-price">No price</p>
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
