<script setup lang="ts">
import { computed } from 'vue'

import { useClientsStore } from '@shared/stores/clients'
import { useProductsStore } from '@shared/stores/products'
import { useTandasStore } from '@shared/stores/tandas'
import { formatDate, formatMoney } from '@shared/db/format'

const clientsStore = useClientsStore()
const productsStore = useProductsStore()
const tandasStore = useTandasStore()

const nextActions = computed(() => tandasStore.activeTandas.slice(0, 5))
</script>

<template>
  <h1 class="page-title">Dashboard</h1>

  <!-- "Next up" (the actionable item) comes first, ahead of the summary figures. -->
  <section class="card next-up">
    <div class="row-between">
      <h2>Next up</h2>
      <RouterLink :to="{ path: '/tandas', query: { new: '1' } }" class="btn btn-primary">
        New tanda
      </RouterLink>
    </div>
    <p v-if="nextActions.length === 0" class="empty-state">
      No active tandas. Create one to start taking orders.
    </p>
    <ul v-else class="upcoming-list">
      <li v-for="tanda in nextActions" :key="tanda.id" class="upcoming-item">
        <div class="row-between">
          <RouterLink :to="`/tandas/${tanda.id}`" class="upcoming-name">{{
            tanda.name
          }}</RouterLink>
          <span class="money">{{ formatMoney(tanda.pendingBalance) }} pending</span>
        </div>
        <div class="row upcoming-meta">
          <span class="muted">{{ formatDate(tanda.date) }}</span>
          <span class="badge badge-info">{{ tanda.type }}</span>
          <span class="badge" :class="tanda.status === 'open' ? 'badge-neutral' : 'badge-success'">
            {{ tanda.status }}
          </span>
        </div>
      </li>
    </ul>
  </section>

  <div class="row-wrap dashboard-cards">
    <section class="card stat-card">
      <h2 class="stat-label">Active tandas</h2>
      <p class="stat-value">{{ tandasStore.activeTandas.length }}</p>
      <RouterLink to="/tandas" class="btn btn-ghost">View tandas</RouterLink>
    </section>

    <section class="card stat-card">
      <h2 class="stat-label">Owed by clients</h2>
      <p class="stat-value money" :class="{ 'money-negative': clientsStore.totalOwed > 0 }">
        {{ formatMoney(clientsStore.totalOwed) }}
      </p>
      <RouterLink to="/clients" class="btn btn-ghost">View clients</RouterLink>
    </section>

    <section class="card stat-card">
      <h2 class="stat-label">Products</h2>
      <p class="stat-value">{{ productsStore.products.length }}</p>
      <RouterLink to="/products" class="btn btn-ghost">View products</RouterLink>
    </section>
  </div>
</template>

<style scoped>
.dashboard-cards {
  margin-bottom: var(--space-4);
}

/* Mobile: the three figures share one compact row; the bottom nav already
   links to each section, so the per-card links are dropped. */
@media (max-width: 720px) {
  .dashboard-cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .stat-card {
    padding: var(--space-3) var(--space-2);
  }

  .stat-value {
    font-size: 1.15rem;
    overflow-wrap: anywhere;
  }

  .stat-label {
    margin-bottom: 0;
    font-size: 0.78rem;
  }

  .stat-card .btn {
    display: none;
  }
}

.page-title {
  margin-bottom: var(--space-4);
}

.stat-card {
  flex: 1 1 180px;
  margin-bottom: 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* The label is the heading; the value reads first visually. */
.stat-label {
  order: 2;
  margin: 0 0 var(--space-2);
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--color-ink-soft);
}

.stat-value {
  order: 1;
  margin: 0 0 var(--space-1);
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-card .btn {
  order: 3;
}

.upcoming-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.upcoming-item {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.upcoming-meta {
  margin-top: var(--space-1);
  flex-wrap: wrap;
}

.upcoming-item:last-child {
  border-bottom: none;
}

.upcoming-name {
  font-weight: 700;
  color: var(--color-ink);
}
</style>
