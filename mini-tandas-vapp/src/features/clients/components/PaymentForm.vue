<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { formatMoney } from '@shared/db/format'
import { fromCents, parseMoneyInput, toCents } from '@shared/db/money'
import { useClientsStore } from '@shared/stores/clients'
import { useTandasStore } from '@shared/stores/tandas'
import type { SaleWithDetails } from '@shared/db/types'
import { notify } from '@shared/ui/useToast'

const props = defineProps<{
  clientId: string
}>()

const route = useRoute()
const clientsStore = useClientsStore()
const tandasStore = useTandasStore()

const amount = ref('')
const amountInput = ref<HTMLInputElement | null>(null)
const note = ref('')
/** Pre-selected from ?pay=<saleId> when arriving via "Record payment" on a sale. */
const initialSaleId = typeof route.query.pay === 'string' ? route.query.pay : ''
const targetSaleId = ref(initialSaleId)
const error = ref('')

const unpaidSales = computed(() =>
  clientsStore.salesFor(props.clientId).filter((sale) => sale.balance > 0),
)

// Drop the selection once the sale is fully paid (or if the id is invalid).
watch(unpaidSales, (list) => {
  if (targetSaleId.value && !list.some((sale) => sale.id === targetSaleId.value)) {
    targetSaleId.value = ''
  }
})

if (initialSaleId) {
  onMounted(() => amountInput.value?.focus())
}

// "Record payment" on a sale of this page updates ?pay=: pre-select it here.
watch(
  () => route.query.pay,
  (saleId) => {
    if (typeof saleId !== 'string' || !saleId) return
    targetSaleId.value = saleId
    amountInput.value?.scrollIntoView({ block: 'center' })
    amountInput.value?.focus({ preventScroll: true })
  },
)

function saleLabel(sale: SaleWithDetails): string {
  const tanda = tandasStore.tandas.find((t) => t.id === sale.tandaId)
  const prefix = tanda ? tanda.name : 'Sale'
  return `${prefix} — ${formatMoney(sale.balance)} pending`
}

const targetSale = computed(
  () => unpaidSales.value.find((sale) => sale.id === targetSaleId.value) ?? null,
)

/**
 * A payment toward a sale that is larger than what the sale still owes (a
 * slipped zero turns $500 into $5,000). Null when there is nothing to warn
 * about: no sale picked (a general payment is always credit), or an amount
 * that is missing, invalid or within the balance.
 */
const overpay = computed(() => {
  const sale = targetSale.value
  const value = parseMoneyInput(amount.value)
  if (!sale || value === null || Number.isNaN(value) || value <= 0) return null
  const excessCents = toCents(value) - toCents(sale.balance)
  if (excessCents <= 0) return null
  return { sale, amount: value, balance: sale.balance, excess: fromCents(excessCents) }
})

const overpayId = 'payment-amount-overpay'
const describedBy = computed(
  () =>
    [error.value ? 'payment-amount-error' : null, overpay.value ? overpayId : null]
      .filter(Boolean)
      .join(' ') || undefined,
)

const applyButton = ref<HTMLButtonElement | null>(null)

/** "Apply $120.00": pay exactly what the sale owes. */
function applyBalance(): void {
  if (!overpay.value) return
  amount.value = overpay.value.balance.toFixed(2)
  amountInput.value?.focus()
}

function resetFields(): void {
  amount.value = ''
  note.value = ''
}

/**
 * "Record as credit": the sale is paid in full and the excess becomes a
 * general payment (abono), so the sale shows Paid instead of a negative
 * balance while the client's combined balance carries the credit. One Undo
 * removes both payments.
 */
function recordWithCredit(): void {
  const over = overpay.value
  if (!over) return
  const noteValue = note.value.trim() === '' ? null : note.value.trim()
  const saleIdPaid = clientsStore.pay({
    clientId: props.clientId,
    saleId: over.sale.id,
    amount: over.balance,
    note: noteValue,
  })
  const creditId = clientsStore.pay({
    clientId: props.clientId,
    saleId: null,
    amount: over.excess,
    note: noteValue,
  })
  resetFields()
  notify(
    `Payment of ${formatMoney(over.amount)} recorded: ${formatMoney(over.balance)} to the sale, ${formatMoney(over.excess)} as credit.`,
    {
      action: {
        label: 'Undo',
        run: () => {
          clientsStore.removePayment(creditId)
          clientsStore.removePayment(saleIdPaid)
        },
      },
    },
  )
}

function reject(message: string): void {
  error.value = message
  amountInput.value?.focus()
}

function submit(): void {
  error.value = ''
  const value = parseMoneyInput(amount.value)
  if (value === null) {
    reject('Amount is required.')
    return
  }
  if (Number.isNaN(value)) {
    reject('Enter an amount such as 150 or 150.50.')
    return
  }
  if (value <= 0) {
    reject('Amount must be greater than zero.')
    return
  }
  // Above the sale balance: the inline notice asks how to apply it.
  if (overpay.value) {
    applyButton.value?.focus()
    return
  }
  const id = clientsStore.pay({
    clientId: props.clientId,
    saleId: targetSaleId.value === '' ? null : targetSaleId.value,
    amount: value,
    note: note.value.trim() === '' ? null : note.value.trim(),
  })
  resetFields()
  notify(`Payment of ${formatMoney(value)} recorded.`, {
    action: { label: 'Undo', run: () => clientsStore.removePayment(id) },
  })
}
</script>

<template>
  <form class="payment-form" @submit.prevent="submit">
    <div class="field">
      <label class="label" for="payment-amount">Amount</label>
      <input
        id="payment-amount"
        ref="amountInput"
        v-model="amount"
        class="input"
        type="text"
        inputmode="decimal"
        name="payment-amount"
        autocomplete="off"
        placeholder="e.g. 150.00…"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
      />
      <p v-if="error" id="payment-amount-error" class="error-text" role="alert">{{ error }}</p>
      <div v-else-if="overpay" :id="overpayId" class="warning-text overpay" role="status">
        <p class="overpay-message">
          This sale only owes {{ formatMoney(overpay.balance) }}. Recording
          {{ formatMoney(overpay.amount) }} pays it in full and keeps
          {{ formatMoney(overpay.excess) }} as credit for the client.
        </p>
        <div class="row-wrap overpay-actions">
          <button ref="applyButton" type="button" class="btn apply-balance" @click="applyBalance">
            Apply {{ formatMoney(overpay.balance) }}
          </button>
          <button type="button" class="btn record-credit" @click="recordWithCredit">
            Record as credit
          </button>
        </div>
      </div>
    </div>
    <div class="field">
      <label class="label" for="payment-target">Apply to</label>
      <select id="payment-target" v-model="targetSaleId" class="select">
        <option value="">General payment (abono)</option>
        <option v-for="sale in unpaidSales" :key="sale.id" :value="sale.id">
          {{ saleLabel(sale) }}
        </option>
      </select>
    </div>
    <div class="field">
      <label class="label" for="payment-note">Note (optional)</label>
      <input
        id="payment-note"
        v-model="note"
        class="input"
        type="text"
        name="payment-note"
        autocomplete="off"
        placeholder="e.g. Cash, transfer…"
      />
    </div>
    <button class="btn btn-primary" type="submit">Record payment</button>
  </form>
</template>

<style scoped>
.payment-form {
  max-width: 420px;
}

.overpay-message {
  margin: 0 0 var(--space-2);
}

.overpay-actions {
  gap: var(--space-2);
}
</style>
