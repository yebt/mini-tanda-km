<script setup lang="ts">
import { computed } from 'vue'

import type { Tanda } from '@shared/db/types'
import { useProductsStore } from '@shared/stores/products'
import { useTandasStore } from '@shared/stores/tandas'

const props = defineProps<{ tanda: Tanda }>()

const tandasStore = useTandasStore()
const productsStore = useProductsStore()

const editable = computed(() => props.tanda.status === 'open')
const catalog = computed(() => productsStore.catalog)

const inventory = computed(() => tandasStore.inventoryFor(props.tanda.id))
const producedBySku = computed(
  () => new Map(inventory.value.map((entry) => [entry.sku.id, entry.produced])),
)
const soldBySku = computed(
  () => new Map(inventory.value.map((entry) => [entry.sku.id, entry.sold])),
)
const availableBySku = computed(
  () => new Map(inventory.value.map((entry) => [entry.sku.id, entry.available])),
)

function producedOf(skuId: string): number {
  return producedBySku.value.get(skuId) ?? 0
}

function soldOf(skuId: string): number {
  return soldBySku.value.get(skuId) ?? 0
}

function availableOf(skuId: string): number {
  return availableBySku.value.get(skuId) ?? 0
}

function onStock(skuId: string, event: Event) {
  const raw = Number((event.target as HTMLInputElement).value)
  const quantity = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  tandasStore.setStock(props.tanda.id, skuId, quantity)
}
</script>

<template>
  <section class="card">
    <div class="row-between">
      <h2>Inventory</h2>
      <span v-if="!editable" class="muted">Locked — tanda is no longer open</span>
    </div>

    <p v-if="catalog.length === 0" class="empty-state">No products in the catalog yet.</p>

    <table v-else class="table">
      <thead>
        <tr>
          <th>SKU</th>
          <th class="col-num">Produced</th>
          <template v-if="!editable">
            <th class="col-num">Sold</th>
            <th class="col-num">Available</th>
          </template>
        </tr>
      </thead>
      <tbody v-for="group in catalog" :key="group.product.id">
        <tr class="group-row">
          <th :colspan="editable ? 2 : 4">{{ group.product.name }}</th>
        </tr>
        <tr v-for="sku in group.skus" :key="sku.id">
          <td>{{ sku.label || 'Default' }}</td>
          <td v-if="editable" class="col-num">
            <input
              class="input qty-input"
              type="number"
              min="0"
              step="1"
              :value="producedOf(sku.id)"
              @change="onStock(sku.id, $event)"
            />
          </td>
          <template v-else>
            <td class="col-num">{{ producedOf(sku.id) }}</td>
            <td class="col-num">{{ soldOf(sku.id) }}</td>
            <td class="col-num" :class="{ 'stock-out': availableOf(sku.id) === 0 }">
              {{ availableOf(sku.id) }}
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: 0;
}

.col-num {
  text-align: right;
}

.qty-input {
  width: 5.5rem;
  text-align: right;
}

.group-row th {
  background: var(--color-bg);
  border-radius: var(--radius-small);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stock-out {
  color: var(--color-danger);
  font-weight: 700;
}
</style>
