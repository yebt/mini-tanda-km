<script setup lang="ts">
import { computed } from 'vue'

import type { Tanda } from '@shared/db/types'
import { canEditInventory } from '@shared/domain/tanda'
import { useProductsStore } from '@shared/stores/products'
import { useTandasStore } from '@shared/stores/tandas'

const props = defineProps<{
  tanda: Tanda
  /** Whether sales are open — enables the per-SKU "Sell" shortcut. */
  sellable: boolean
}>()

const emit = defineEmits<{
  sell: [skuId: string]
}>()

const tandasStore = useTandasStore()
const productsStore = useProductsStore()

const editable = computed(() => canEditInventory(props.tanda))
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

function canSellSku(skuId: string): boolean {
  return props.sellable && availableOf(skuId) > 0
}

function onStock(skuId: string, event: Event) {
  const raw = Number((event.target as HTMLInputElement).value)
  const quantity = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  tandasStore.setStock(props.tanda.id, skuId, quantity)
}

function sell(skuId: string) {
  emit('sell', skuId)
}
</script>

<template>
  <section class="card">
    <div class="row-between">
      <h2>Inventory</h2>
      <span v-if="!editable" class="muted">Locked — tanda is no longer open</span>
    </div>

    <p v-if="catalog.length === 0" class="empty-state">No products in the catalog yet.</p>

    <template v-else>
      <table class="desktop-only table">
        <thead>
          <tr>
            <th>SKU</th>
            <th class="col-num">Produced</th>
            <template v-if="!editable">
              <th class="col-num">Sold</th>
              <th class="col-num">Available</th>
              <th v-if="sellable" class="col-action" />
            </template>
          </tr>
        </thead>
        <tbody v-for="group in catalog" :key="group.product.id">
          <tr class="group-row">
            <th :colspan="editable ? 2 : sellable ? 5 : 4">{{ group.product.name }}</th>
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
              <td v-if="sellable" class="col-action">
                <button
                  v-if="canSellSku(sku.id)"
                  type="button"
                  class="btn btn-ghost"
                  @click="sell(sku.id)"
                >
                  Sell
                </button>
                <span v-else class="muted">—</span>
              </td>
            </template>
          </tr>
        </tbody>
      </table>

      <ul class="inventory-list mobile-only">
        <li v-for="group in catalog" :key="group.product.id" class="inventory-group">
          <p class="group-name">{{ group.product.name }}</p>
          <div v-for="sku in group.skus" :key="sku.id" class="inventory-row">
            <div class="inventory-info">
              <span class="sku-label">{{ sku.label || 'Default' }}</span>
              <span v-if="editable" class="muted">produced</span>
              <span v-else class="muted" :class="{ 'stock-out': availableOf(sku.id) === 0 }">
                {{ availableOf(sku.id) }} available
              </span>
            </div>
            <input
              v-if="editable"
              class="input qty-input"
              type="number"
              min="0"
              step="1"
              :value="producedOf(sku.id)"
              @change="onStock(sku.id, $event)"
            />
            <button
              v-else-if="canSellSku(sku.id)"
              type="button"
              class="btn btn-ghost sell-btn"
              @click="sell(sku.id)"
            >
              Sell
            </button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: 0;
}

.col-num {
  text-align: right;
}

.col-action {
  text-align: right;
  width: 1%;
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

.inventory-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.inventory-group + .inventory-group {
  margin-top: var(--space-3);
}

.group-name {
  margin: 0 0 var(--space-1);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-ink-soft);
}

.inventory-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.inventory-row:last-child {
  border-bottom: none;
}

.inventory-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sku-label {
  font-weight: 600;
}

.sell-btn {
  flex-shrink: 0;
}
</style>
