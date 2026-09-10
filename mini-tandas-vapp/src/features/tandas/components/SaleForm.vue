<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatMoney } from '@shared/db/format'
import type { TandaType } from '@shared/db/types'
import { useClientsStore } from '@shared/stores/clients'
import { useProductsStore } from '@shared/stores/products'
import { useTandasStore } from '@shared/stores/tandas'

const props = defineProps<{ tandaId: string; type: TandaType }>()

const tandasStore = useTandasStore()
const clientsStore = useClientsStore()
const productsStore = useProductsStore()

const NEW_CLIENT = '__new__'

const clientChoice = ref('')
const newClientName = ref('')
const selectedSkuId = ref('')
const quantity = ref(1)

interface DraftLine {
  skuId: string
  label: string
  price: number
  quantity: number
}

const lines = ref<DraftLine[]>([])
const error = ref('')

const catalog = computed(() => productsStore.catalog)
const clients = computed(() => clientsStore.clients)

const inventory = computed(() =>
  props.type === 'anticipated' ? tandasStore.inventoryFor(props.tandaId) : [],
)
const availableBySku = computed(
  () => new Map(inventory.value.map((entry) => [entry.sku.id, entry.available])),
)

function availabilityOf(skuId: string): number {
  return availableBySku.value.get(skuId) ?? 0
}

/** Remaining stock for the picked SKU once lines already added are accounted for. */
const remainingForSelected = computed<number | null>(() => {
  if (props.type !== 'anticipated' || !selectedSkuId.value) return null
  const inLines = lines.value
    .filter((line) => line.skuId === selectedSkuId.value)
    .reduce((sum, line) => sum + line.quantity, 0)
  return availabilityOf(selectedSkuId.value) - inLines
})

const runningTotal = computed(() =>
  lines.value.reduce((sum, line) => sum + line.price * line.quantity, 0),
)

const canSubmit = computed(
  () => lines.value.length > 0 && (clientChoice.value === NEW_CLIENT || clientChoice.value !== ''),
)

function addLine() {
  error.value = ''
  const sku = productsStore.skus.find((s) => s.id === selectedSkuId.value)
  if (!sku) {
    error.value = 'Pick a product first.'
    return
  }
  if (sku.price === null) {
    error.value = `"${sku.productName}" has no price set.`
    return
  }
  const qty = quantity.value
  if (!Number.isInteger(qty) || qty < 1) {
    error.value = 'Quantity must be a whole number of at least 1.'
    return
  }
  if (props.type === 'anticipated') {
    const alreadyInLines = lines.value
      .filter((line) => line.skuId === sku.id)
      .reduce((sum, line) => sum + line.quantity, 0)
    if (alreadyInLines + qty > availabilityOf(sku.id)) {
      error.value = `Only ${availabilityOf(sku.id)} available for ${sku.label || sku.productName}.`
      return
    }
  }
  const existing = lines.value.find((line) => line.skuId === sku.id)
  if (existing) {
    existing.quantity += qty
  } else {
    lines.value.push({
      skuId: sku.id,
      label: sku.label ? `${sku.productName} (${sku.label})` : sku.productName,
      price: sku.price,
      quantity: qty,
    })
  }
  selectedSkuId.value = ''
  quantity.value = 1
}

function removeLine(skuId: string) {
  lines.value = lines.value.filter((line) => line.skuId !== skuId)
}

function resetForm() {
  clientChoice.value = ''
  newClientName.value = ''
  selectedSkuId.value = ''
  quantity.value = 1
  lines.value = []
  error.value = ''
}

function submit() {
  error.value = ''
  if (lines.value.length === 0) {
    error.value = 'Add at least one product.'
    return
  }
  let clientId = clientChoice.value
  if (clientId === NEW_CLIENT) {
    const name = newClientName.value.trim()
    if (!name) {
      error.value = 'Enter the new client name.'
      return
    }
    clientId = clientsStore.addClient(name)
  }
  if (!clientId) {
    error.value = 'Pick a client.'
    return
  }
  const result = tandasStore.addSale({
    tandaId: props.tandaId,
    clientId,
    items: lines.value.map((line) => ({ skuId: line.skuId, quantity: line.quantity })),
  })
  if (!result.ok) {
    error.value = result.error
    return
  }
  resetForm()
}
</script>

<template>
  <section class="card">
    <h2>New sale</h2>

    <div class="field">
      <label class="label" for="sale-client">Client</label>
      <select id="sale-client" v-model="clientChoice" class="select">
        <option value="" disabled>Pick a client…</option>
        <option v-for="client in clients" :key="client.id" :value="client.id">
          {{ client.name }}
        </option>
        <option :value="NEW_CLIENT">+ New client…</option>
      </select>
      <input
        v-if="clientChoice === NEW_CLIENT"
        v-model="newClientName"
        class="input new-client-input"
        placeholder="Client name"
      />
    </div>

    <div class="field">
      <label class="label" for="sale-sku">Product</label>
      <select id="sale-sku" v-model="selectedSkuId" class="select">
        <option value="" disabled>Pick a product…</option>
        <optgroup v-for="group in catalog" :key="group.product.id" :label="group.product.name">
          <option
            v-for="sku in group.skus"
            :key="sku.id"
            :value="sku.id"
            :disabled="sku.price === null"
          >
            {{ sku.label || 'Default' }} —
            {{ sku.price === null ? 'no price' : formatMoney(sku.price) }}
          </option>
        </optgroup>
      </select>
      <p
        v-if="remainingForSelected !== null"
        class="muted"
        :class="{ 'stock-out': remainingForSelected <= 0 }"
      >
        {{ remainingForSelected }} available
      </p>
    </div>

    <div class="field row">
      <input
        v-model.number="quantity"
        class="input qty-input"
        type="number"
        min="1"
        step="1"
        aria-label="Quantity"
      />
      <button type="button" class="btn" @click="addLine">Add line</button>
    </div>

    <table v-if="lines.length > 0" class="table">
      <tbody>
        <tr v-for="line in lines" :key="line.skuId">
          <td>{{ line.quantity }} × {{ line.label }}</td>
          <td class="col-num money">{{ formatMoney(line.price * line.quantity) }}</td>
          <td class="col-action">
            <button type="button" class="btn btn-ghost btn-danger" @click="removeLine(line.skuId)">
              Remove
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div class="row-between total-row">
      <span class="muted">Total</span>
      <span class="money">{{ formatMoney(runningTotal) }}</span>
    </div>

    <button type="button" class="btn btn-primary" :disabled="!canSubmit" @click="submit">
      Add sale
    </button>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: var(--space-4);
}

.new-client-input {
  margin-top: var(--space-2);
}

.qty-input {
  width: 5.5rem;
}

.col-num {
  text-align: right;
}

.col-action {
  text-align: right;
  width: 1%;
}

.total-row {
  margin: var(--space-3) 0;
  font-size: 1.05rem;
}

.stock-out {
  color: var(--color-danger);
  font-weight: 700;
}
</style>
