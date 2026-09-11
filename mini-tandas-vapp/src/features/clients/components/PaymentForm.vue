<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { formatMoney } from '@shared/db/format'
import { useClientsStore } from '@shared/stores/clients'
import { useTandasStore } from '@shared/stores/tandas'
import type { SaleWithDetails } from '@shared/db/types'

const props = defineProps<{
  clientId: string
}>()

const route = useRoute()
const clientsStore = useClientsStore()
const tandasStore = useTandasStore()

const amount = ref<number | null>(null)
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

function saleLabel(sale: SaleWithDetails): string {
  const tanda = tandasStore.tandas.find((t) => t.id === sale.tandaId)
  const prefix = tanda ? tanda.name : 'Sale'
  return `${prefix} — ${formatMoney(sale.balance)} pending`
}

function submit(): void {
  error.value = ''
  const value = amount.value
  if (value === null || Number.isNaN(value)) {
    error.value = 'Amount is required.'
    return
  }
  if (value <= 0) {
    error.value = 'Amount must be greater than zero.'
    return
  }
  clientsStore.pay({
    clientId: props.clientId,
    saleId: targetSaleId.value === '' ? null : targetSaleId.value,
    amount: value,
    note: note.value.trim() === '' ? null : note.value.trim(),
  })
  amount.value = null
  note.value = ''
}
</script>

<template>
  <form class="payment-form" @submit.prevent="submit">
    <div class="field">
      <label class="label" for="payment-amount">Amount</label>
      <input
        id="payment-amount"
        ref="amountInput"
        v-model.number="amount"
        class="input"
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
      />
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
        placeholder="e.g. Cash, transfer"
      />
    </div>
    <p v-if="error" class="error-text">{{ error }}</p>
    <button class="btn btn-primary" type="submit">Record payment</button>
  </form>
</template>

<style scoped>
.payment-form {
  max-width: 420px;
}
</style>
