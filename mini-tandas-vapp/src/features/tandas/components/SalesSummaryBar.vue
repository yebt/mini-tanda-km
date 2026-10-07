<script setup lang="ts">
import { computed } from 'vue'

import { formatMoney } from '@shared/db/format'

import type { SalesSummary } from '../lib/saleSummary'

const props = defineProps<{
  summary: SalesSummary
}>()

const salesLabel = computed(() => (props.summary.count === 1 ? 'sale' : 'sales'))
</script>

<template>
  <ul class="sales-summary" aria-label="Sales summary">
    <li>
      <strong>{{ summary.count }}</strong> {{ salesLabel }}
    </li>
    <li>
      <strong class="money">{{ formatMoney(summary.total) }}</strong> total
    </li>
    <li>
      <strong class="money">{{ formatMoney(summary.paid) }}</strong> paid
    </li>
    <li :class="{ 'is-owed': summary.pending > 0 }">
      <strong class="money">{{ formatMoney(summary.pending) }}</strong> pending
    </li>
    <li>
      <strong>{{ summary.delivered }}/{{ summary.count }}</strong> delivered
    </li>
  </ul>
</template>

<style scoped>
.sales-summary {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  color: var(--color-ink-soft);
  font-size: 0.9rem;
}

.sales-summary strong {
  color: var(--color-ink);
  font-weight: 700;
}

/* The amount still owed is the figure to act on: danger tone, label kept. */
.sales-summary .is-owed strong {
  color: var(--color-danger);
}
</style>
