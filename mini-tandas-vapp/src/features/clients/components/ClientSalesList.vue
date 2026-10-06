<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { formatDate, formatMoney } from '@shared/db/format'
import type { SaleWithDetails, TandaSummary } from '@shared/db/types'
import { useClientsStore } from '@shared/stores/clients'
import { useTandasStore } from '@shared/stores/tandas'
import { statusBadge, statusLabel } from '@shared/ui/badges'

const props = defineProps<{
  clientId: string
}>()

const route = useRoute()
const router = useRouter()
const clientsStore = useClientsStore()
const tandasStore = useTandasStore()

interface TandaGroup {
  tandaId: string
  tanda: TandaSummary | null
  sales: SaleWithDetails[]
  balance: number
}

/** The client's sales grouped per tanda (SPECS), newest tanda first. */
const groups = computed<TandaGroup[]>(() => {
  const byTanda = new Map<string, TandaGroup>()
  for (const sale of clientsStore.salesFor(props.clientId)) {
    let group = byTanda.get(sale.tandaId)
    if (!group) {
      const tanda = tandasStore.tandas.find((t) => t.id === sale.tandaId) ?? null
      group = { tandaId: sale.tandaId, tanda, sales: [], balance: 0 }
      byTanda.set(sale.tandaId, group)
    }
    group.sales.push(sale)
    group.balance += sale.balance
  }
  return [...byTanda.values()].sort((a, b) =>
    (b.tanda?.date ?? '').localeCompare(a.tanda?.date ?? ''),
  )
})

/** Pre-select this sale in the payment form on the same page (?pay=<saleId>). */
function recordPayment(sale: SaleWithDetails) {
  void router.replace({ query: { ...route.query, pay: sale.id } })
}
</script>

<template>
  <p v-if="groups.length === 0" class="empty-state">No sales yet.</p>
  <template v-else>
    <section v-for="group in groups" :key="group.tandaId" class="tanda-group">
      <div class="row-between group-head">
        <h3>
          <RouterLink v-if="group.tanda" :to="`/tandas/${group.tandaId}`">
            {{ group.tanda.name }}
          </RouterLink>
          <template v-else>Removed tanda</template>
        </h3>
        <span v-if="group.balance > 0" class="money money-negative">
          {{ formatMoney(group.balance) }} pending
        </span>
      </div>
      <div v-if="group.tanda" class="row group-meta">
        <span class="muted">{{ formatDate(group.tanda.date) }}</span>
        <span class="badge" :class="statusBadge(group.tanda.status)">
          {{ statusLabel(group.tanda.status) }}
        </span>
      </div>

      <ul class="sale-list">
        <li v-for="sale in group.sales" :key="sale.id" class="sale-item">
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
          <button
            v-if="sale.balance > 0"
            type="button"
            class="btn btn-ghost pay-btn"
            @click="recordPayment(sale)"
          >
            Record payment
          </button>
        </li>
      </ul>
    </section>
  </template>
</template>

<style scoped>
.tanda-group + .tanda-group {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 2px solid var(--color-border);
}

.group-head h3 {
  margin: 0;
  font-size: 1rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.group-meta {
  margin-top: var(--space-1);
  flex-wrap: wrap;
}

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
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
}

.pay-btn {
  margin-top: var(--space-2);
  padding-left: 0;
}
</style>
