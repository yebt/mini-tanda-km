<script setup lang="ts">
import { computed } from 'vue'

import { formatDateTime, formatMoney } from '@shared/db/format'
import { useClientsStore } from '@shared/stores/clients'
import type { PaymentWithContext } from '@shared/db/types'

const props = defineProps<{
  clientId: string
}>()

const clientsStore = useClientsStore()

const payments = computed<PaymentWithContext[]>(() => clientsStore.paymentsFor(props.clientId))

function remove(payment: PaymentWithContext): void {
  if (window.confirm(`Delete payment of ${formatMoney(payment.amount)}?`)) {
    clientsStore.removePayment(payment.id)
  }
}
</script>

<template>
  <p v-if="payments.length === 0" class="empty-state">No payments yet.</p>
  <ul v-else class="payment-list">
    <li v-for="payment in payments" :key="payment.id" class="row-between payment-item">
      <div class="row payment-main">
        <span class="money">{{ formatMoney(payment.amount) }}</span>
        <span v-if="payment.saleId" class="badge badge-info">Sale · {{ payment.saleLabel }}</span>
        <span v-else class="badge badge-neutral">General</span>
        <span v-if="payment.note" class="muted">{{ payment.note }}</span>
      </div>
      <div class="row">
        <span class="muted">{{ formatDateTime(payment.createdAt) }}</span>
        <button class="btn btn-danger" type="button" @click="remove(payment)">Delete</button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.payment-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.payment-item {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.payment-item:last-child {
  border-bottom: none;
}

.payment-main {
  flex-wrap: wrap;
}
</style>
