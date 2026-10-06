<script setup lang="ts">
import { computed } from 'vue'

import type { Tanda, TandaStatus } from '@shared/db/types'
import { nextStatus as nextOf, previousStatus as previousOf } from '@shared/domain/tanda'
import { useTandasStore } from '@shared/stores/tandas'
import { confirmDialog } from '@shared/ui/useConfirm'

const props = defineProps<{ tanda: Tanda }>()

const tandasStore = useTandasStore()

const STATUS_CAPTIONS: Record<Tanda['type'], Record<TandaStatus, string>> = {
  scheduled: {
    open: 'Taking pre-orders and sales',
    production: 'Baking is underway — sales are closed',
    ready: 'Deliveries can now be marked',
    closed: 'This tanda is finished',
  },
  anticipated: {
    open: 'Define the batch inventory, then advance to production',
    production: 'Baking is underway — sales open once ready',
    ready: 'Sales are open against the batch inventory',
    closed: 'This tanda is finished',
  },
}

const STATUS_BADGE: Record<TandaStatus, string> = {
  open: 'badge-info',
  production: 'badge-neutral',
  ready: 'badge-success',
  closed: 'badge-neutral',
}

const statusBadgeClass = computed(() => STATUS_BADGE[props.tanda.status])
const caption = computed(() => STATUS_CAPTIONS[props.tanda.type][props.tanda.status])

const nextStatus = computed<TandaStatus | null>(() => nextOf(props.tanda.status))
const previousStatus = computed<TandaStatus | null>(() => previousOf(props.tanda.status))

function advance() {
  if (nextStatus.value) {
    tandasStore.moveStatus(props.tanda.id, nextStatus.value)
  }
}

async function goBack() {
  if (!previousStatus.value) return
  const ok = await confirmDialog(
    `Move "${props.tanda.name}" back to "${previousStatus.value}"?\nSales and delivery marks stay as they are.`,
    'Move back',
  )
  if (ok) {
    tandasStore.moveStatus(props.tanda.id, previousStatus.value)
  }
}
</script>

<template>
  <section class="card">
    <div class="row-between status-row">
      <div class="row status-info">
        <span class="badge" :class="statusBadgeClass">{{ tanda.status }}</span>
        <p class="caption">{{ caption }}</p>
      </div>
      <div class="row status-actions">
        <button v-if="previousStatus" class="btn btn-ghost" @click="goBack">
          ← Back to {{ previousStatus }}
        </button>
        <button v-if="nextStatus" class="btn btn-primary" @click="advance">
          Advance to {{ nextStatus }}
        </button>
        <span v-if="!nextStatus && !previousStatus" class="muted">Tanda is closed</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.status-row {
  flex-wrap: wrap;
}

.status-info {
  flex: 1 1 16rem;
  min-width: 0;
}

.status-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.caption {
  margin: 0;
  min-width: 0;
  color: var(--color-ink-soft);
  font-size: 0.85rem;
}

/* Narrow screens: actions take their own full-width row and may wrap. */
@media (max-width: 720px) {
  .status-actions {
    flex: 1 1 100%;
  }

  .status-actions .btn {
    flex: 1 1 auto;
    justify-content: center;
    white-space: normal;
    text-align: center;
  }
}
</style>
