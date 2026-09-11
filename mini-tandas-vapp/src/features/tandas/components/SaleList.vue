<script setup lang="ts">
import { computed } from 'vue'

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

    <article v-for="sale in sales" :key="sale.id" class="card">
      <div class="row-between">
        <div class="row">
          <strong>{{ sale.client.name }}</strong>
          <span class="muted">{{ formatDateTime(sale.createdAt) }}</span>
        </div>
        <div class="row">
          <span v-if="sale.balance > 0" class="badge badge-danger">
            Pending {{ formatMoney(sale.balance) }}
          </span>
          <span v-else class="badge badge-success">Paid</span>
          <button type="button" class="btn btn-ghost btn-danger" @click="remove(sale)">
            Delete
          </button>
        </div>
      </div>

      <table class="table">
        <tbody>
          <tr v-for="line in sale.items" :key="line.skuId">
            <td>{{ line.quantity }} × {{ line.label }}</td>
            <td class="col-num money">{{ formatMoney(line.lineTotal) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="row-between total-row">
        <label class="row delivered-row">
          <input
            type="checkbox"
            :checked="sale.delivered"
            :disabled="!canMarkDelivered"
            @change="onDelivered(sale, $event)"
          />
          Delivered
        </label>
        <span class="money">{{ formatMoney(sale.total) }}</span>
      </div>
    </article>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: var(--space-3);
}

.col-num {
  text-align: right;
}

.total-row {
  margin-top: var(--space-2);
}

.delivered-row {
  font-size: 0.9rem;
  color: var(--color-ink-soft);
  cursor: pointer;
}

.delivered-row input:disabled {
  cursor: not-allowed;
}
</style>
