<script setup lang="ts">
import { computed } from 'vue'

import { formatDate, formatMoney } from '@shared/db/format'
import type { ClientSummary } from '@shared/db/types'

const props = defineProps<{
  summary: ClientSummary
}>()

const owesMoney = computed(() => props.summary.balance > 0)
const balanceLabel = computed(() =>
  owesMoney.value ? 'Owes' : props.summary.balance < 0 ? 'Credit' : 'Settled',
)
</script>

<template>
  <section class="card">
    <div class="row-between">
      <h1>{{ summary.name }}</h1>
      <span class="muted">Client since {{ formatDate(summary.createdAt) }}</span>
    </div>
    <div class="row-wrap summary-stats">
      <div class="stat">
        <p class="muted">Total sales</p>
        <p class="money stat-value">{{ formatMoney(summary.totalSales) }}</p>
      </div>
      <div class="stat">
        <p class="muted">Total payments</p>
        <p class="money stat-value">{{ formatMoney(summary.totalPayments) }}</p>
      </div>
      <div class="stat">
        <p class="muted">Current balance</p>
        <p class="money stat-value balance" :class="{ 'money-negative': owesMoney }">
          {{ formatMoney(summary.balance) }}
        </p>
        <p class="muted">{{ balanceLabel }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-stats {
  gap: var(--space-6);
}

.stat {
  min-width: 140px;
}

.stat p {
  margin: 0;
}

.stat-value {
  font-size: 1.4rem;
}

.balance {
  font-size: 1.8rem;
}
</style>
