<script setup lang="ts">
import { computed } from 'vue'

import { formatDate, formatMoney } from '@shared/db/format'
import { useClientsStore } from '@shared/stores/clients'
import type { SaleWithDetails } from '@shared/db/types'

const props = defineProps<{
  clientId: string
}>()

const clientsStore = useClientsStore()

const sales = computed<SaleWithDetails[]>(() => clientsStore.salesFor(props.clientId))
</script>

<template>
  <p v-if="sales.length === 0" class="empty-state">No sales yet.</p>
  <ul v-else class="sale-list">
    <li v-for="sale in sales" :key="sale.id" class="sale-item">
      <div class="row-between">
        <span class="muted">{{ formatDate(sale.createdAt) }}</span>
        <span class="row">
          <span v-if="sale.delivered" class="badge badge-info">Delivered</span>
          <span v-if="sale.balance <= 0" class="badge badge-success">Paid</span>
          <span v-else class="badge badge-danger">Pending</span>
        </span>
      </div>
      <ul class="line-list">
        <li v-for="line in sale.items" :key="line.skuId" class="row-between line-item">
          <span>{{ line.quantity }} × {{ line.label }}</span>
          <span class="money">{{ formatMoney(line.lineTotal) }}</span>
        </li>
      </ul>
      <div class="row-between sale-totals">
        <span class="muted">Paid {{ formatMoney(sale.paid) }}</span>
        <span class="money">Total {{ formatMoney(sale.total) }}</span>
        <span class="money" :class="{ 'money-negative': sale.balance > 0 }">
          Balance {{ formatMoney(sale.balance) }}
        </span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.sale-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sale-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.sale-item:last-child {
  border-bottom: none;
}

.line-list {
  list-style: none;
  margin: var(--space-2) 0;
  padding: 0;
}

.line-item {
  padding: var(--space-1) 0;
}

.sale-totals {
  gap: var(--space-4);
}
</style>
