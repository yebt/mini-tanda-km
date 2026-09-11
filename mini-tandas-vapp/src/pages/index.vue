<script setup lang="ts">
import { useClientsStore } from '@shared/stores/clients'
import { useProductsStore } from '@shared/stores/products'
import { useTandasStore } from '@shared/stores/tandas'
import { formatDate, formatMoney } from '@shared/db/format'

const clientsStore = useClientsStore()
const productsStore = useProductsStore()
const tandasStore = useTandasStore()

const nextActions = tandasStore.activeTandas.slice(0, 5)
</script>

<template>
  <div class="row-wrap dashboard-cards">
    <section class="card stat-card">
      <h2 class="stat-value">{{ tandasStore.activeTandas.length }}</h2>
      <p class="muted">active tandas</p>
      <RouterLink to="/tandas" class="btn btn-ghost">View tandas</RouterLink>
    </section>

    <section class="card stat-card">
      <h2 class="stat-value" :class="{ 'money-negative': clientsStore.totalOwed > 0 }">
        {{ formatMoney(clientsStore.totalOwed) }}
      </h2>
      <p class="muted">owed by clients</p>
      <RouterLink to="/clients" class="btn btn-ghost">View clients</RouterLink>
    </section>

    <section class="card stat-card">
      <h2 class="stat-value">{{ productsStore.products.length }}</h2>
      <p class="muted">products</p>
      <RouterLink to="/products" class="btn btn-ghost">View products</RouterLink>
    </section>
  </div>

  <section class="card">
    <div class="row-between">
      <h2>Next up</h2>
      <RouterLink to="/tandas" class="btn btn-primary">New tanda</RouterLink>
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
</template>

<style scoped>
.dashboard-cards {
  margin-bottom: var(--space-4);
}

.stat-card {
  flex: 1 1 180px;
  margin-bottom: 0;
  text-align: center;
}

.stat-value {
  font-size: 1.8rem;
  margin-bottom: var(--space-1);
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
