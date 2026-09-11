<script setup lang="ts">
import { computed } from 'vue'
import { Truck } from 'lucide-vue-next'

import { formatDateTime, formatMoney } from '@shared/db/format'
import type { SaleWithDetails, TandaStatus } from '@shared/db/types'
import { useTandasStore } from '@shared/stores/tandas'
import { confirmDialog } from '@shared/ui/useConfirm'

const props = defineProps<{ tandaId: string; status: TandaStatus }>()

const tandasStore = useTandasStore()

const sales = computed(() => tandasStore.salesFor(props.tandaId))

/** Delivery can only be marked once the tanda passes from production to ready. */
const canMarkDelivered = computed(() => props.status === 'ready' || props.status === 'closed')

function onDelivered(sale: SaleWithDetails, event: Event) {
  tandasStore.toggleDelivered(sale.id, (event.target as HTMLInputElement).checked)
}

async function remove(sale: SaleWithDetails) {
  if (await confirmDialog(`Delete the sale for ${sale.client.name}?`, 'Delete')) {
    tandasStore.removeSale(sale.id)
  }
}
</script>

<template>
  <section>
    <h2>Sales</h2>

    <p v-if="sales.length === 0" class="card empty-state">No sales yet.</p>

    <article v-for="sale in sales" :key="sale.id" class="card sale-card">
      <div class="row-between sale-head">
        <div class="sale-client">
          <strong class="sale-client-name">{{ sale.client.name }}</strong>
          <span class="muted">{{ formatDateTime(sale.createdAt) }}</span>
        </div>
        <div class="row sale-actions">
          <span v-if="sale.balance > 0" class="badge badge-danger">
            Pending {{ formatMoney(sale.balance) }}
          </span>
          <span v-else class="badge badge-success">Paid</span>
          <button type="button" class="btn btn-ghost btn-danger" @click="remove(sale)">
            Delete
          </button>
        </div>
      </div>

      <ul class="sale-items">
        <li v-for="line in sale.items" :key="line.skuId" class="row-between sale-item">
          <span class="sale-item-label">{{ line.quantity }} × {{ line.label }}</span>
          <span class="money">{{ formatMoney(line.lineTotal) }}</span>
        </li>
      </ul>

      <div class="row-between total-row">
        <label
          class="delivered-toggle"
          :class="{ 'is-on': sale.delivered, 'is-disabled': !canMarkDelivered }"
        >
          <input
            type="checkbox"
            class="delivered-input"
            :checked="sale.delivered"
            :disabled="!canMarkDelivered"
            @change="onDelivered(sale, $event)"
          />
          <span class="track" aria-hidden="true">
            <span class="thumb">
              <Truck :size="12" :stroke-width="2.4" />
            </span>
          </span>
          <span class="delivered-label">
            {{ sale.delivered ? 'Delivered' : 'Mark delivered' }}
          </span>
        </label>
        <span class="money sale-total">{{ formatMoney(sale.total) }}</span>
      </div>
    </article>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: var(--space-3);
}

.sale-head {
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.sale-client {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.sale-client-name {
  overflow-wrap: anywhere;
}

.sale-actions {
  flex-shrink: 0;
  margin-left: auto;
}

.sale-items {
  list-style: none;
  margin: var(--space-3) 0 0;
  padding: 0;
}

.sale-item {
  padding: var(--space-1) 0;
  gap: var(--space-3);
}

.sale-item + .sale-item {
  border-top: 1px solid var(--color-border);
}

.sale-item-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.total-row {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.sale-total {
  font-size: 1.05rem;
}

/* ── Delivered toggle ─────────────────────────────────────────────────── */
.delivered-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-ink-soft);
  user-select: none;
}

.delivered-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.track {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  width: 42px;
  height: 24px;
  padding: 2px;
  border-radius: 999px;
  background: var(--color-border);
  transition: background-color 160ms ease;
}

.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-ink-soft);
  box-shadow: 0 1px 2px rgb(0 0 0 / 25%);
  transform: translateX(0);
  transition:
    transform 160ms ease,
    color 160ms ease;
}

.delivered-toggle.is-on {
  color: var(--color-success);
}

.delivered-toggle.is-on .track {
  background: var(--color-success);
}

.delivered-toggle.is-on .thumb {
  transform: translateX(18px);
  color: var(--color-success);
}

.delivered-toggle.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.delivered-toggle.is-disabled .track {
  background: var(--color-border);
}

.delivered-toggle.is-disabled.is-on .track {
  background: var(--color-success);
}

@media (prefers-reduced-motion: reduce) {
  .track,
  .thumb {
    transition: none;
  }
}
</style>
