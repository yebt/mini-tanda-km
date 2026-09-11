<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatMoney } from '@shared/db/format'
import type { TandaType } from '@shared/db/types'
import { useClientsStore } from '@shared/stores/clients'
import { useProductsStore } from '@shared/stores/products'
import { useTandasStore } from '@shared/stores/tandas'
import Combobox, { type ComboOption } from '@shared/ui/Combobox.vue'

const props = defineProps<{
  tandaId: string
  type: TandaType
  /** Pre-selected SKU (e.g. when launching the form from the inventory). */
  initialSkuId?: string
}>()

const emit = defineEmits<{
  submitted: []
}>()

const tandasStore = useTandasStore()
const clientsStore = useClientsStore()
const productsStore = useProductsStore()

const clientChoice = ref('')
const selectedSkuId = ref(props.initialSkuId ?? '')
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

const clientOptions = computed<ComboOption[]>(() =>
  clients.value.map((client) => ({ value: client.id, label: client.name })),
)

const skuOptions = computed<ComboOption[]>(() =>
  catalog.value.flatMap((group) =>
    group.skus.map((sku) => {
      const unavailable = props.type === 'anticipated' && availabilityOf(sku.id) <= 0
      const unpriced = sku.price === null
      return {
        value: sku.id,
        label: sku.label ? `${group.product.name} (${sku.label})` : group.product.name,
        hint: unpriced
          ? 'no price'
          : unavailable
            ? `no stock · ${formatMoney(sku.price!)}`
            : `${formatMoney(sku.price!)} · ${availabilityOf(sku.id)} available`,
        disabled: unpriced || unavailable,
        disabledReason: unpriced ? 'No price set' : 'Out of stock',
      }
    }),
  ),
)

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

const canSubmit = computed(() => lines.value.length > 0 && clientChoice.value !== '')

function onCreateClient(query: string) {
  const id = clientsStore.addClient(query.trim())
  clientChoice.value = id
}

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
  if (!clientChoice.value) {
    error.value = 'Pick a client.'
    return
  }
  const result = tandasStore.addSale({
    tandaId: props.tandaId,
    clientId: clientChoice.value,
    items: lines.value.map((line) => ({ skuId: line.skuId, quantity: line.quantity })),
  })
  if (!result.ok) {
    error.value = result.error
    return
  }
  resetForm()
  emit('submitted')
}
</script>

<template>
  <section class="card sale-form">
    <h2>New sale</h2>

    <div class="field">
      <label class="label" for="sale-client">Client</label>
      <Combobox
        v-model="clientChoice"
        :options="clientOptions"
        input-id="sale-client"
        placeholder="Search or create a client…"
        allow-create
        @create="onCreateClient"
      />
    </div>

    <div class="field">
      <label class="label" for="sale-sku">Product</label>
      <Combobox
        v-model="selectedSkuId"
        :options="skuOptions"
        input-id="sale-sku"
        placeholder="Search a product…"
      />
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
