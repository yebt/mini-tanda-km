<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatDate, formatMoney } from '@shared/db/format'
import { useClientsStore } from '@shared/stores/clients'

const clientsStore = useClientsStore()

const name = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const error = ref('')

const sortedClients = computed(() =>
  [...clientsStore.clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  ),
)

function submit(): void {
  error.value = ''
  const value = name.value.trim()
  if (value === '') {
    error.value = 'Name is required.'
    return
  }
  clientsStore.addClient(value)
  name.value = ''
}

function focusNameInput(): void {
  nameInput.value?.focus()
}
</script>

<template>
  <section class="card">
    <h1>Clients</h1>
    <form class="row-wrap new-client-form" @submit.prevent="submit">
      <div class="field new-client-field">
        <label class="label" for="client-name">New client</label>
        <input
          id="client-name"
          ref="nameInput"
          v-model="name"
          class="input"
          type="text"
          placeholder="Client name"
        />
      </div>
      <button class="btn btn-primary new-client-button" type="submit">Add client</button>
    </form>
    <p v-if="error" class="error-text">{{ error }}</p>
  </section>

  <button class="fab mobile-only" aria-label="Add client" @click="focusNameInput">+</button>

  <section class="card">
    <p v-if="sortedClients.length === 0" class="empty-state">No clients yet.</p>
    <table v-else class="desktop-only table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Created</th>
          <th>Total sales</th>
          <th>Total payments</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="client in sortedClients" :key="client.id">
          <td>
            <RouterLink :to="`/clients/${client.id}`">{{ client.name }}</RouterLink>
          </td>
          <td class="muted">{{ formatDate(client.createdAt) }}</td>
          <td class="money">{{ formatMoney(client.totalSales) }}</td>
          <td class="money">{{ formatMoney(client.totalPayments) }}</td>
          <td class="money" :class="{ 'money-negative': client.balance > 0 }">
            {{ formatMoney(client.balance) }}
          </td>
        </tr>
      </tbody>
    </table>

    <ul v-if="sortedClients.length > 0" class="client-list mobile-only">
      <li v-for="client in sortedClients" :key="client.id">
        <RouterLink :to="`/clients/${client.id}`" class="client-item">
          <div class="client-main">
            <span class="client-name">{{ client.name }}</span>
            <span class="muted">since {{ formatDate(client.createdAt) }}</span>
          </div>
          <div class="client-figures">
            <span class="money" :class="{ 'money-negative': client.balance > 0 }">
              {{ formatMoney(client.balance) }}
            </span>
            <span class="muted">owed</span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.new-client-form {
  align-items: flex-end;
}

.new-client-field {
  flex: 1 1 260px;
  margin-bottom: 0;
}

.new-client-button {
  margin-bottom: 1px;
}

.client-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.client-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-1);
  border-bottom: 1px solid var(--color-border);
  color: inherit;
}

.client-item:last-child {
  border-bottom: none;
}

.client-main {
  display: flex;
  flex-direction: column;
}

.client-name {
  font-weight: 700;
}

.client-figures {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
</style>
