<script setup lang="ts">
import { computed } from 'vue'

import { TANDA_STATUS_ORDER, type Tanda, type TandaStatus } from '@shared/db/types'
import { useTandasStore } from '@shared/stores/tandas'

const props = defineProps<{ tanda: Tanda }>()

const tandasStore = useTandasStore()

const STATUS_CAPTIONS: Record<TandaStatus, string> = {
  open: 'Taking pre-orders and sales',
  production: 'Baking is underway — sales are closed',
  ready: 'Deliveries can now be marked',
  closed: 'This tanda is finished',
}

const STATUS_BADGE: Record<TandaStatus, string> = {
  open: 'badge-info',
  production: 'badge-neutral',
  ready: 'badge-success',
  closed: 'badge-neutral',
}

const statusBadgeClass = computed(() => STATUS_BADGE[props.tanda.status])
const caption = computed(() => STATUS_CAPTIONS[props.tanda.status])

const nextStatus = computed<TandaStatus | null>(() => {
  const index = TANDA_STATUS_ORDER.indexOf(props.tanda.status)
  return index >= 0 ? (TANDA_STATUS_ORDER[index + 1] ?? null) : null
})

function advance() {
  if (nextStatus.value) {
    tandasStore.moveStatus(props.tanda.id, nextStatus.value)
  }
}
</script>

<template>
  <section class="card">
    <div class="row-between">
      <div class="row">
        <span class="badge" :class="statusBadgeClass">{{ tanda.status }}</span>
        <p class="caption">{{ caption }}</p>
      </div>
      <button v-if="nextStatus" class="btn btn-primary" @click="advance">
        Advance to {{ nextStatus }}
      </button>
      <span v-else class="muted">Tanda is closed</span>
    </div>
  </section>
</template>

<style scoped>
.caption {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.85rem;
}
</style>
