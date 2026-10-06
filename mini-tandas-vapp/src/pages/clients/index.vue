<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatDate, formatMoney } from '@shared/db/format'
import type { ClientSummary } from '@shared/db/types'
import { useClientsStore } from '@shared/stores/clients'
import ActionMenu from '@shared/ui/ActionMenu.vue'
import { confirmDialog } from '@shared/ui/useConfirm'
import { notify } from '@shared/ui/useToast'

const clientsStore = useClientsStore()

const name = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const error = ref('')
const actionError = ref('')

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
    focusNameInput()
    return
  }
  clientsStore.addClient(value)
  name.value = ''
  notify(`Client "${value}" added.`)
}

function focusNameInput(): void {
  nameInput.value?.focus()
}

async function remove(client: ClientSummary): Promise<void> {
  actionError.value = ''
  if (await confirmDialog(`Delete "${client.name}"?`, 'Delete')) {
    const result = clientsStore.removeClient(client.id)
    if (!result.ok) {
      actionError.value = result.error
      return
    }
    notify(`Client "${client.name}" deleted.`)
  }
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
          name="client-name"
          autocomplete="off"
          placeholder="e.g. Ana López…"
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? 'client-name-error' : undefined"
        />
      </div>
      <button class="btn btn-primary new-client-button" type="submit">Add client</button>
    </form>
    <p v-if="error" id="client-name-error" class="error-text" role="alert">{{ error }}</p>
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
          <th class="actions-col" aria-label="Actions" />
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
          <td class="actions-col">
            <ActionMenu :show-edit="false" @remove="remove(client)" />
          </td>
        </tr>
      </tbody>
    </table>

    <ul v-if="sortedClients.length > 0" class="client-list mobile-only">
      <li v-for="client in sortedClients" :key="client.id" class="client-row">
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
        <ActionMenu :show-edit="false" @remove="remove(client)" />
      </li>
    </ul>
    <p v-if="actionError" class="error-text" role="alert">{{ actionError }}</p>
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

.client-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.client-row:last-child {
  border-bottom: none;
}

.client-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-1);
  color: inherit;
}

.actions-col {
  width: 48px;
  text-align: right;
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
