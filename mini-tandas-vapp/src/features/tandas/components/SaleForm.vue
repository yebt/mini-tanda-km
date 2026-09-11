<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Minus, Plus, X } from 'lucide-vue-next'

import { formatMoney } from '@shared/db/format'
import type { SaleWithDetails, TandaType } from '@shared/db/types'
import { useClientsStore } from '@shared/stores/clients'
import { useProductsStore } from '@shared/stores/products'
import { useTandasStore } from '@shared/stores/tandas'
import Combobox, { type ComboOption } from '@shared/ui/Combobox.vue'

const props = defineProps<{
  tandaId: string
  type: TandaType
  /** Pre-selected SKU (e.g. when launching the form from the inventory). */
  initialSkuId?: string
  /** Existing sale being edited; when set, the form prefills and updates it. */
  initialSale?: SaleWithDetails
}>()

const emit = defineEmits<{
  submitted: []
}>()

const tandasStore = useTandasStore()
const clientsStore = useClientsStore()
const productsStore = useProductsStore()

const clientChoice = ref(props.initialSale?.clientId ?? '')
const selectedSkuId = ref(props.initialSale ? '' : (props.initialSkuId ?? ''))
const quantity = ref(1)

interface DraftLine {
  skuId: string
  label: string
  price: number
  quantity: number
}

const lines = ref<DraftLine[]>(
  props.initialSale?.items.map((line) => ({
    skuId: line.skuId,
    label: line.label,
    price: line.unitPrice,
    quantity: line.quantity,
  })) ?? [],
)
const error = ref('')

const skuCombo = ref<InstanceType<typeof Combobox> | null>(null)

const isEdit = computed(() => props.initialSale !== undefined)

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

/** Stock the current draft may take for a SKU: batch availability plus what the
 *  sale being edited already holds (so it never fails against itself). */
function stockLimitOf(skuId: string): number {
  const own = props.initialSale?.items.find((line) => line.skuId === skuId)?.quantity ?? 0
  return availabilityOf(skuId) + own
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
  return stockLimitOf(selectedSkuId.value) - inLines
})

const canBumpQtyUp = computed(
  () => remainingForSelected.value === null || quantity.value < remainingForSelected.value,
)

const runningTotal = computed(() =>
  lines.value.reduce((sum, line) => sum + line.price * line.quantity, 0),
)

const canSubmit = computed(() => lines.value.length > 0 && clientChoice.value !== '')

// Any edit to the pending line clears a stale error from the previous attempt.
watch([selectedSkuId, quantity], () => {
  error.value = ''
})

/** Focus the product search so the next product can be typed immediately. */
function focusSkuSearch() {
  skuCombo.value?.focus()
}

onMounted(focusSkuSearch)

function onCreateClient(query: string) {
  const id = clientsStore.addClient(query.trim())
  clientChoice.value = id
}

/** Upper bound a line may reach: batch stock (plus the edit sale's own) or none. */
function lineCap(line: DraftLine): number {
  return props.type === 'anticipated' ? stockLimitOf(line.skuId) : Number.POSITIVE_INFINITY
}

function bumpQty(delta: number) {
  const base = Number.isInteger(quantity.value) && quantity.value >= 1 ? quantity.value : 1
  const next = Math.max(1, base + delta)
  quantity.value =
    remainingForSelected.value === null
      ? next
      : Math.min(next, Math.max(remainingForSelected.value, 1))
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
    const limit = stockLimitOf(sku.id)
    if (alreadyInLines + qty > limit) {
      error.value = `Only ${Math.max(limit - alreadyInLines, 0)} available for ${sku.label || sku.productName}.`
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
  focusSkuSearch()
}

/** Enter inside the product search adds the line once a SKU is picked. */
function onSkuEnter() {
  if (selectedSkuId.value) addLine()
}

function bumpLine(line: DraftLine, delta: number) {
  line.quantity = Math.min(Math.max(line.quantity + delta, 1), lineCap(line))
}

function onLineQtyInput(line: DraftLine, event: Event) {
  const input = event.target as HTMLInputElement
  const next = Number(input.value)
  if (!Number.isInteger(next) || next < 1) {
    input.value = String(line.quantity)
    return
  }
  line.quantity = Math.min(next, lineCap(line))
  input.value = String(line.quantity)
}

/** Remaining stock label for a line (anticipated tandas only). */
function lineStockLabel(line: DraftLine): string | null {
  if (props.type !== 'anticipated') return null
  const left = Math.max(stockLimitOf(line.skuId) - line.quantity, 0)
  return left === 0 ? 'none left' : `${left} left`
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
  const items = lines.value.map((line) => ({ skuId: line.skuId, quantity: line.quantity }))
  const result = props.initialSale
    ? tandasStore.editSale(props.initialSale.id, items)
    : tandasStore.addSale({ tandaId: props.tandaId, clientId: clientChoice.value, items })
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
    <h2>{{ isEdit ? 'Edit sale' : 'New sale' }}</h2>

    <div class="field">
      <label class="label" for="sale-client">Client</label>
      <p v-if="initialSale" class="client-static">{{ initialSale.client.name }}</p>
      <Combobox
        v-else
        v-model="clientChoice"
        :options="clientOptions"
        input-id="sale-client"
        placeholder="Search or create a client…"
        allow-create
        @create="onCreateClient"
      />
    </div>

    <div class="field" @keydown.enter="onSkuEnter">
      <label class="label" for="sale-sku">Product</label>
      <Combobox
        ref="skuCombo"
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

    <div class="field composer">
      <div class="stepper">
        <button
          type="button"
          class="stepper-btn"
          aria-label="Decrease amount"
          :disabled="quantity <= 1"
          @click="bumpQty(-1)"
        >
          <Minus :size="16" />
        </button>
        <input
          v-model.number="quantity"
          class="input stepper-input"
          type="number"
          min="1"
          step="1"
          aria-label="Quantity"
          @keydown.enter.prevent="addLine"
        />
        <button
          type="button"
          class="stepper-btn"
          aria-label="Increase amount"
          :disabled="!canBumpQtyUp"
          @click="bumpQty(1)"
        >
          <Plus :size="16" />
        </button>
      </div>
      <button type="button" class="btn add-line-btn" @click="addLine">
        <Plus :size="16" />
        Add line
      </button>
    </div>

    <p v-if="error" class="error-text" role="alert">{{ error }}</p>

    <template v-if="lines.length > 0">
      <h3 class="lines-title">Items</h3>
      <ul class="lines">
        <li v-for="line in lines" :key="line.skuId" class="line-card">
          <div class="line-info">
            <span class="line-label">{{ line.label }}</span>
            <span class="muted">{{ formatMoney(line.price) }} each</span>
            <span
              v-if="lineStockLabel(line) !== null"
              class="line-stock"
              :class="{ 'is-out': lineStockLabel(line) === 'none left' }"
            >
              {{ lineStockLabel(line) }}
            </span>
          </div>
          <div class="stepper stepper-sm">
            <button
              type="button"
              class="stepper-btn"
              :aria-label="`One less ${line.label}`"
              :disabled="line.quantity <= 1"
              @click="bumpLine(line, -1)"
            >
              <Minus :size="14" />
            </button>
            <input
              class="input stepper-input"
              type="number"
              min="1"
              step="1"
              :value="line.quantity"
              :aria-label="`Units of ${line.label}`"
              @change="onLineQtyInput(line, $event)"
            />
            <button
              type="button"
              class="stepper-btn"
              :aria-label="`One more ${line.label}`"
              :disabled="line.quantity >= lineCap(line)"
              @click="bumpLine(line, 1)"
            >
              <Plus :size="14" />
            </button>
          </div>
          <span class="money line-total">{{ formatMoney(line.price * line.quantity) }}</span>
          <button
            type="button"
            class="line-remove"
            :aria-label="`Remove ${line.label}`"
            @click="removeLine(line.skuId)"
          >
            <X :size="15" />
          </button>
        </li>
      </ul>
    </template>
    <p v-else class="muted lines-empty">No items yet — search a product above to add it.</p>

    <footer class="form-footer">
      <div class="row-between total-row">
        <span class="muted"
          >Total · {{ lines.length }} {{ lines.length === 1 ? 'item' : 'items' }}</span
        >
        <span class="money">{{ formatMoney(runningTotal) }}</span>
      </div>
      <button
        type="button"
        class="btn btn-primary footer-submit"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ isEdit ? 'Save changes' : 'Add sale' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: var(--space-4);
}

.composer {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
}

/* ── Quantity stepper (draft composer + inline line rows) ─────────────── */
.stepper {
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
}

.stepper-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  padding: 0;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.stepper-btn:first-child {
  border-radius: var(--radius-small) 0 0 var(--radius-small);
}

.stepper-btn:last-child {
  border-radius: 0 var(--radius-small) var(--radius-small) 0;
}

.stepper-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.stepper-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.stepper-input {
  width: 3rem;
  padding-inline: 0.25rem;
  text-align: center;
  border-radius: 0;
  border-left: none;
  border-right: none;
  -webkit-appearance: none;
  appearance: none;
  -moz-appearance: textfield;
}

.stepper-input::-webkit-outer-spin-button,
.stepper-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.add-line-btn {
  flex: 1;
  justify-content: center;
  min-height: 44px;
}

/* ── Lines: stacked cards on mobile, one row on desktop ───────────────── */
.lines-title {
  margin: var(--space-4) 0 var(--space-2);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-soft);
}

.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.line-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.line-info {
  flex: 1 1 calc(100% - 2.5rem);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-2);
  min-width: 0;
}

.line-label {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.line-stock {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-success);
}

.line-stock.is-out {
  color: var(--color-danger);
}

.stepper-sm .stepper-btn {
  width: 36px;
  min-height: 36px;
}

.stepper-sm .stepper-input {
  width: 2.8rem;
}

.line-total {
  margin-left: auto;
  font-size: 1.02rem;
}

.line-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-small);
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
}

.line-remove:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.lines-empty {
  margin: var(--space-2) 0;
}

/* ── Sticky summary: stays pinned at the foot of the dialog sheet ─────── */
.form-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  margin: var(--space-4) calc(-1 * var(--space-6)) calc(-1 * var(--space-6));
  padding: var(--space-3) var(--space-6) var(--space-4);
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 var(--radius) var(--radius);
}

.total-row {
  margin-bottom: var(--space-3);
  font-size: 1.05rem;
}

.footer-submit {
  width: 100%;
  justify-content: center;
  min-height: 44px;
}

.client-static {
  margin: 0;
  padding: var(--space-2) 0;
  font-weight: 600;
}

.stock-out {
  color: var(--color-danger);
  font-weight: 700;
}

@media (min-width: 721px) {
  .line-card {
    flex-wrap: nowrap;
  }

  .line-info {
    flex: 1 1 auto;
  }

  .line-total {
    margin-left: 0;
  }
}
</style>
