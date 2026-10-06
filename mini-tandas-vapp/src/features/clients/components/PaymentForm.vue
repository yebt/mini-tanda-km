<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { formatMoney } from '@shared/db/format'
import { parseMoneyInput } from '@shared/db/money'
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
  const id = clientsStore.pay({
    clientId: props.clientId,
    saleId: targetSaleId.value === '' ? null : targetSaleId.value,
    amount: value,
    note: note.value.trim() === '' ? null : note.value.trim(),
  })
  amount.value = ''
  note.value = ''
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
        :aria-describedby="error ? 'payment-amount-error' : undefined"
      />
      <p v-if="error" id="payment-amount-error" class="error-text" role="alert">{{ error }}</p>
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
</style>
