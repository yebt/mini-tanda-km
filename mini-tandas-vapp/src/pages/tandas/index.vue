<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { formatDate, formatMoney, todayISO } from '@shared/db/format'
import type { TandaType } from '@shared/db/types'
import { statusBadge, statusLabel, typeBadge, typeLabel } from '@shared/ui/badges'
import { useTandasStore } from '@shared/stores/tandas'
import { useIsMobile } from '@shared/ui/useMediaQuery'

const route = useRoute()
const router = useRouter()
const tandasStore = useTandasStore()

/** Render one layout only: the hidden one would still cost rendering (and image decoding). */
const isMobile = useIsMobile()

const showForm = ref(false)
const name = ref('')
const date = ref(todayISO())
const type = ref<TandaType>('scheduled')

const TYPE_HELPER: Record<TandaType, string> = {
  scheduled: 'Take pre-orders now, produce later',
  anticipated: 'Register what you produced, then sell from that stock',
}

const typeHelper = computed(() => TYPE_HELPER[type.value])

function openForm() {
  name.value = `Tanda ${todayISO()}`
  date.value = todayISO()
  type.value = 'scheduled'
  showForm.value = true
}

// "New tanda" elsewhere (dashboard) links here with ?new=1: open the form directly.
onMounted(() => {
  if (route.query.new === undefined) return
  openForm()
  void router.replace({ query: { ...route.query, new: undefined } })
})

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed || !date.value) return
  const id = tandasStore.addTanda({ name: trimmed, date: date.value, type: type.value })
  showForm.value = false
  void router.push(`/tandas/${id}`)
}
</script>

<template>
  <div class="row-between page-head">
    <h1>Tandas</h1>
    <button v-if="!showForm" class="btn btn-primary desktop-only" @click="openForm">
      New tanda
    </button>
  </div>

  <button v-if="!showForm" class="fab mobile-only" aria-label="New tanda" @click="openForm">
    +
  </button>

  <form v-if="showForm" class="card" @submit.prevent="submit">
    <div class="field">
      <label class="label" for="tanda-name">Name</label>
      <input
        id="tanda-name"
        v-model="name"
        class="input"
        name="tanda-name"
        autocomplete="off"
        required
      />
    </div>
    <div class="field">
      <label class="label" for="tanda-date">Date</label>
      <input id="tanda-date" v-model="date" class="input" type="date" required />
    </div>
    <div class="field">
      <label class="label" for="tanda-type">Type</label>
      <select id="tanda-type" v-model="type" class="select">
        <option value="scheduled">Scheduled</option>
        <option value="anticipated">Anticipated</option>
      </select>
      <p class="muted">{{ typeHelper }}</p>
    </div>
    <div class="row">
      <button type="submit" class="btn btn-primary">Create tanda</button>
      <button type="button" class="btn btn-ghost" @click="showForm = false">Cancel</button>
    </div>
  </form>

  <div v-if="tandasStore.tandas.length === 0" class="card empty-state">No tandas yet.</div>

  <div v-else-if="!isMobile" class="card table-card desktop-only">
    <table class="table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Date</th>
        <th>Type</th>
        <th>Status</th>
        <th class="col-num">Sales</th>
        <th class="col-num">Revenue</th>
        <th class="col-num">Pending</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="tanda in tandasStore.tandas" :key="tanda.id">
        <td>
          <RouterLink :to="`/tandas/${tanda.id}`">{{ tanda.name }}</RouterLink>
        </td>
        <td>{{ formatDate(tanda.date) }}</td>
        <td>
          <span class="badge" :class="typeBadge(tanda.type)">{{ typeLabel(tanda.type) }}</span>
        </td>
        <td>
          <span class="badge" :class="statusBadge(tanda.status)">{{
            statusLabel(tanda.status)
          }}</span>
        </td>
        <td class="col-num">{{ tanda.saleCount }}</td>
        <td class="col-num money">{{ formatMoney(tanda.revenue) }}</td>
        <td class="col-num money" :class="{ 'money-negative': tanda.pendingBalance > 0 }">
          {{ formatMoney(tanda.pendingBalance) }}
        </td>
      </tr>
    </tbody>
    </table>
  </div>

  <div v-else class="mobile-only">
    <RouterLink
      v-for="tanda in tandasStore.tandas"
      :key="tanda.id"
      :to="`/tandas/${tanda.id}`"
      class="card tanda-card"
    >
      <div class="row-between">
        <span class="tanda-name">{{ tanda.name }}</span>
        <span class="badge" :class="statusBadge(tanda.status)">{{
            statusLabel(tanda.status)
          }}</span>
      </div>
      <div class="row tanda-meta">
        <span class="muted">{{ formatDate(tanda.date) }}</span>
        <span class="badge" :class="typeBadge(tanda.type)">{{ typeLabel(tanda.type) }}</span>
      </div>
      <div class="row tanda-figures">
        <span>{{ tanda.saleCount }} sales</span>
        <span class="money">{{ formatMoney(tanda.revenue) }}</span>
        <span v-if="tanda.pendingBalance > 0" class="money money-negative">
          {{ formatMoney(tanda.pendingBalance) }} pending
        </span>
      </div>
    </RouterLink>
  </div>
</template>

<style scoped>
.page-head {
  margin-bottom: var(--space-4);
}

.tanda-card {
  display: block;
  color: inherit;
}

.tanda-card:hover {
  border-color: var(--color-primary);
}

.tanda-name {
  font-weight: 700;
}

.tanda-meta {
  margin-top: var(--space-1);
}

.tanda-figures {
  margin-top: var(--space-2);
  font-size: 0.85rem;
  color: var(--color-ink-soft);
  flex-wrap: wrap;
}
</style>
