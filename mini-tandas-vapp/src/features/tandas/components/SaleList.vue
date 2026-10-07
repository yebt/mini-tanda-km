<script setup lang="ts">
import { computed, useId } from 'vue'
import { useRouter } from 'vue-router'
import { Truck } from 'lucide-vue-next'

import { formatDateTime, formatMoney } from '@shared/db/format'
import type { SaleWithDetails, Tanda } from '@shared/db/types'
import { canDeliver, canSell } from '@shared/domain/tanda'
import { useTandasStore } from '@shared/stores/tandas'
import ActionMenu from '@shared/ui/ActionMenu.vue'
import { confirmDialog } from '@shared/ui/useConfirm'
import { notify } from '@shared/ui/useToast'

const props = defineProps<{
  tanda: Pick<Tanda, 'id' | 'type' | 'status'>
  /** Inside a "Sales" tab panel the tab already labels the list: keep the heading for structure only. */
  hideHeading?: boolean
}>()

const emit = defineEmits<{
  edit: [sale: SaleWithDetails]
}>()

const tandasStore = useTandasStore()
const router = useRouter()

const sales = computed(() => tandasStore.salesFor(props.tanda.id))

const canMarkDelivered = computed(() => canDeliver(props.tanda))
const deliveryHintId = useId()
/** Editing a sale is selling: only allowed while the tanda's sales window is open. */
const canEditSales = computed(() => canSell(props.tanda))

function onDelivered(sale: SaleWithDetails, event: Event) {
  const input = event.target as HTMLInputElement
  const result = tandasStore.toggleDelivered(sale.id, input.checked)
  if (!result.ok) input.checked = sale.delivered
}

/** Jump to the client's ledger with this sale pre-selected in the payment form. */
function recordPayment(sale: SaleWithDetails) {
  router.push({ path: `/clients/${sale.client.id}`, query: { pay: sale.id } })
}

async function remove(sale: SaleWithDetails) {
  const credit =
    sale.paid > 0
      ? `\nPayments of ${formatMoney(sale.paid)} will stay as general credit for ${sale.client.name}.`
      : ''
  const message = `Delete the sale for ${sale.client.name} (${formatMoney(sale.total)})?${credit}`
  if (await confirmDialog(message, 'Delete sale', { tone: 'danger' })) {
    tandasStore.removeSale(sale.id)
    notify(`Sale for ${sale.client.name} deleted.`)
  }
}
</script>

<template>
  <section>
    <h2 :class="{ 'visually-hidden': hideHeading }">Sales</h2>

    <p v-if="sales.length === 0" class="card empty-state">No sales yet.</p>

    <article v-for="sale in sales" :key="sale.id" class="card sale-card">
      <header class="sale-head">
        <div class="sale-client">
          <strong class="sale-client-name">{{ sale.client.name }}</strong>
          <span class="muted">{{ formatDateTime(sale.createdAt) }}</span>
        </div>
        <ActionMenu
          :show-edit="canEditSales"
          :show-pay="sale.balance > 0"
          @edit="emit('edit', sale)"
          @pay="recordPayment(sale)"
          @remove="remove(sale)"
        />
      </header>

      <ul class="sale-items">
        <li v-for="line in sale.items" :key="line.skuId" class="sale-item">
          <span class="sale-item-label">{{ line.quantity }} × {{ line.label }}</span>
          <span class="money sale-item-amount">{{ formatMoney(line.lineTotal) }}</span>
        </li>
      </ul>

      <footer class="sale-foot">
        <label
          class="delivered-toggle"
          :class="{ 'is-on': sale.delivered, 'is-disabled': !canMarkDelivered }"
        >
          <input
            type="checkbox"
            class="delivered-input"
            :checked="sale.delivered"
            :disabled="!canMarkDelivered"
            :aria-describedby="canMarkDelivered ? undefined : `${deliveryHintId}-${sale.id}`"
            @change="onDelivered(sale, $event)"
          />
          <span class="track" aria-hidden="true">
            <span class="thumb">
              <Truck :size="12" :stroke-width="2.4" />
            </span>
          </span>
          <span class="delivered-label">
            {{ sale.delivered ? 'Delivered' : 'Mark delivered' }}
          </span>
        </label>
        <span v-if="!canMarkDelivered" :id="`${deliveryHintId}-${sale.id}`" class="delivery-hint">
          Available once the tanda is ready
        </span>

        <div class="sale-amounts">
          <span v-if="sale.balance > 0" class="badge badge-danger">
            Pending {{ formatMoney(sale.balance) }}
          </span>
          <span v-else class="badge badge-success">Paid</span>
          <span class="money sale-total">{{ formatMoney(sale.total) }}</span>
        </div>
      </footer>
    </article>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: var(--space-3);
}

.sale-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (min-width: 721px) {
  .sale-card {
    transition: border-color 160ms ease;
  }

  .sale-card:hover,
  .sale-card:focus-within {
    border-color: var(--color-primary);
  }
}

.sale-head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.sale-client {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.sale-client-name {
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.sale-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.sale-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-1) 0;
}

.sale-item + .sale-item {
  border-top: 1px solid var(--color-border);
}

.sale-item-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.sale-item-amount {
  flex-shrink: 0;
  color: var(--color-ink-soft);
}

.sale-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin-top: var(--space-1);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.sale-amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  margin-left: auto;
}

.sale-total {
  font-size: 1.15rem;
  font-weight: 700;
}

/* ── Delivered toggle ─────────────────────────────────────────────────── */
.delivery-hint {
  flex-basis: 100%;
  order: 1;
  font-size: 0.8rem;
  color: var(--color-ink-soft);
}

.delivered-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-ink-soft);
  user-select: none;
}

@media (pointer: coarse) {
  .delivered-toggle {
    min-height: 44px;
  }
}

.delivered-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.track {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  width: 42px;
  height: 24px;
  padding: 2px;
  border-radius: 999px;
  background: var(--color-control-border);
  transition: background-color 160ms ease;
}

/* The native checkbox is visually hidden: show its keyboard focus on the track. */
.delivered-input:focus-visible + .track {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-ink-soft);
  box-shadow: 0 1px 2px rgb(0 0 0 / 25%);
  transform: translateX(0);
  transition:
    transform 160ms ease,
    color 160ms ease;
}

.delivered-toggle.is-on {
  color: var(--color-success);
}

.delivered-toggle.is-on .track {
  background: var(--color-success);
}

.delivered-toggle.is-on .thumb {
  transform: translateX(18px);
  color: var(--color-success);
}

.delivered-toggle.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.delivered-toggle.is-disabled .track {
  background: var(--color-border);
}

.delivered-toggle.is-disabled.is-on .track {
  background: var(--color-success);
}

@media (prefers-reduced-motion: reduce) {
  .track,
  .thumb {
    transition: none;
  }
}
</style>
