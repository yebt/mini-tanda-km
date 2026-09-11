<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Tanda, TandaType } from '@shared/db/types'
import { formatDate } from '@shared/db/format'
import { useTandasStore } from '@shared/stores/tandas'

const props = defineProps<{ tanda: Tanda }>()

const tandasStore = useTandasStore()

const name = ref(props.tanda.name)
const date = ref(props.tanda.date)

watch(
  () => props.tanda.name,
  (value) => {
    name.value = value
  },
)
watch(
  () => props.tanda.date,
  (value) => {
    date.value = value
  },
)

const editable = computed(() => props.tanda.status === 'open')

const TYPE_BADGE: Record<TandaType, string> = {
  scheduled: 'badge-info',
  anticipated: 'badge-neutral',
}
const typeBadgeClass = computed(() => TYPE_BADGE[props.tanda.type])

function saveName() {
  const trimmed = name.value.trim()
  if (trimmed && trimmed !== props.tanda.name) {
    tandasStore.saveTanda(props.tanda.id, { name: trimmed })
  } else {
    name.value = props.tanda.name
  }
}

function saveDate() {
  if (date.value && date.value !== props.tanda.date) {
    tandasStore.saveTanda(props.tanda.id, { date: date.value })
  } else {
    date.value = props.tanda.date
  }
}
</script>

<template>
  <section class="card">
    <div class="row-between">
      <div>
        <div v-if="editable" class="row header-edit">
          <input v-model="name" class="input name-input" @change="saveName" />
          <input v-model="date" class="input date-input" type="date" @change="saveDate" />
        </div>
        <div v-else class="row header-view">
          <h1>{{ tanda.name }}</h1>
          <span class="muted">{{ formatDate(tanda.date) }}</span>
        </div>
        <span class="badge" :class="typeBadgeClass">{{ tanda.type }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.header-edit {
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
}

.name-input {
  max-width: 22rem;
  min-width: 0;
  flex: 1;
  font-weight: 700;
}

.date-input {
  max-width: 11rem;
}

h1 {
  margin-bottom: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.header-view {
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  h1 {
    font-size: 1.3rem;
    flex-basis: 100%;
  }
}
</style>
