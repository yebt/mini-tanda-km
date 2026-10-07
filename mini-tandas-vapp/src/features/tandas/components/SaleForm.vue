<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, X } from 'lucide-vue-next'

import { formatMoney } from '@shared/db/format'
import type { SaleWithDetails, TandaType } from '@shared/db/types'
import { useClientsStore } from '@shared/stores/clients'
import { useProductsStore } from '@shared/stores/products'
import { useTandasStore } from '@shared/stores/tandas'
import Combobox, { type ComboOption } from '@shared/ui/Combobox.vue'
import QuantityStepper from '@shared/ui/QuantityStepper.vue'
import { notify } from '@shared/ui/useToast'

import { useSaleDraft, type DraftLine } from '../composables/useSaleDraft'

const props = defineProps<{
  tandaId: string
  type: TandaType
  /** Pre-selected SKU (e.g. when launching the form from the inventory). */
  initialSkuId?: string
  /** Existing sale being edited; when set, the form prefills and updates it. */
  initialSale?: SaleWithDetails
  /** Id for the heading, so a wrapping dialog can reference it as its name. */
  titleId?: string
}>()

const emit = defineEmits<{
  submitted: []
}>()

const tandasStore = useTandasStore()
const clientsStore = useClientsStore()
const productsStore = useProductsStore()

const clientChoice = ref(props.initialSale?.clientId ?? '')

const {
  selectedSkuId,
  quantity,
  lines,
  error,
  skuOptions,
  remainingForSelected,
  runningTotal,
  lineCap,
  lineStockLabel,
  addLine: addDraftLine,
  setLineQuantity,
  removeLine,
  reset,
  items,
} = useSaleDraft({
  type: () => props.type,
  catalog: () => productsStore.catalog,
  inventory: () => tandasStore.inventoryFor(props.tandaId),
  initialSkuId: props.initialSkuId,
  initialSale: props.initialSale,
})

const skuCombo = ref<InstanceType<typeof Combobox> | null>(null)

const isEdit = computed(() => props.initialSale !== undefined)

const clientOptions = computed<ComboOption[]>(() =>
  clientsStore.clients.map((client) => ({ value: client.id, label: client.name })),
)

/** Focus the product search so the next product can be typed immediately. */
function focusSkuSearch() {
  skuCombo.value?.focus()
}

onMounted(focusSkuSearch)

function onCreateClient(query: string) {
  const id = clientsStore.addClient(query.trim())
  clientChoice.value = id
}

function addLine() {
  if (addDraftLine()) focusSkuSearch()
}

/** Enter inside the product search adds the line once a SKU is picked. */
function onSkuEnter() {
  if (selectedSkuId.value) addLine()
}

/** The pending line can take at most what is left of the picked SKU (at least 1). */
const composerMax = computed(() =>
  remainingForSelected.value === null
    ? Number.POSITIVE_INFINITY
    : Math.max(remainingForSelected.value, 1),
)

function onLineQuantity(line: DraftLine, next: number) {
  setLineQuantity(line, next)
}

/**
 * Lines that closing the form would lose: every line of a new sale, or the
 * lines that differ from the sale being edited.
 */
function draftSize(): number {
  const original = props.initialSale?.items
  if (!original) return lines.value.length
  const changed = lines.value.filter(
    (line) => original.find((item) => item.skuId === line.skuId)?.quantity !== line.quantity,
  ).length
  return changed + original.filter((item) => !lines.value.some((l) => l.skuId === item.skuId)).length
}

defineExpose({ draftSize })

function resetForm() {
  clientChoice.value = ''
  reset()
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
  const saleItems = items()
  const result = props.initialSale
    ? tandasStore.editSale(props.initialSale.id, saleItems)
    : tandasStore.addSale({
        tandaId: props.tandaId,
        clientId: clientChoice.value,
        items: saleItems,
      })
  if (!result.ok) {
    error.value = result.error
    return
  }
  const clientName =
    props.initialSale?.client.name ??
    clientsStore.clients.find((client) => client.id === clientChoice.value)?.name
  notify(
    props.initialSale
      ? `Sale for ${clientName} updated.`
      : `Sale for ${clientName} added — ${formatMoney(runningTotal.value)}.`,
  )
  resetForm()
  emit('submitted')
}
</script>

<template>
  <section class="card sale-form">
    <h2 :id="titleId">{{ isEdit ? 'Edit sale' : 'New sale' }}</h2>

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
      <QuantityStepper
        v-model="quantity"
        :max="composerMax"
        label="Quantity"
        decrease-label="Decrease amount"
        increase-label="Increase amount"
        @enter="addLine"
      />
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
            <span class="muted line-price">{{ formatMoney(line.price) }} each</span>
            <span
              v-if="lineStockLabel(line) !== null"
              class="line-stock"
              :class="{ 'is-out': lineStockLabel(line) === 'none left' }"
            >
              {{ lineStockLabel(line) }}
            </span>
          </div>
          <QuantityStepper
            class="line-qty"
            size="sm"
            :model-value="line.quantity"
            :max="lineCap(line)"
            :label="`Units of ${line.label}`"
            :decrease-label="`One less ${line.label}`"
            :increase-label="`One more ${line.label}`"
            @update:model-value="onLineQuantity(line, $event)"
          />
          <span class="money line-total">{{ formatMoney(line.price * line.quantity) }}</span>
          <button
            type="button"
            class="line-remove"
            :aria-label="`Remove ${line.label}`"
            @click="removeLine(line.skuId)"
          >
            <X :size="16" aria-hidden="true" />
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
      <!-- Stays enabled: submitting explains what is missing (client, products). -->
      <button type="button" class="btn btn-primary footer-submit" @click="submit">
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

/* "Add line" matches the stepper: same height and border weight. */
.add-line-btn {
  flex: 1;
  justify-content: center;
  height: 44px;
  border-color: var(--color-control-border);
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

/* Mobile: name + unit price over (stepper | line total); remove top-right. */
.line-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'info remove'
    'qty total';
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.line-info {
  grid-area: info;
  align-self: start;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-2);
  min-width: 0;
  padding-top: 0.2rem;
}

.line-qty {
  grid-area: qty;
  justify-self: start;
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

.line-total {
  grid-area: total;
  justify-self: end;
  font-size: 1.02rem;
  text-align: right;
}

.line-remove {
  grid-area: remove;
  align-self: start;
  justify-self: end;
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

@media (pointer: coarse) {
  .line-remove {
    width: 44px;
    height: 44px;
    margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0 0;
  }
}

.lines-empty {
  margin: var(--space-2) 0;
}

/* ── Sticky summary: stays pinned at the foot of the dialog sheet ─────── */
.form-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  /* Bleeds to the card edges: offsets follow the card padding. */
  margin: var(--space-4) calc(-1 * var(--pad-card)) calc(-1 * var(--pad-card));
  padding: var(--space-3) var(--pad-card) var(--space-4);
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

/* Desktop: one row — info | stepper | total | remove, columns aligned across rows. */
@media (min-width: 721px) {
  .line-card {
    grid-template-columns: minmax(0, 1fr) auto 7.5rem auto;
    grid-template-areas: 'info qty total remove';
    padding-block: var(--space-2);
  }

  .line-info {
    align-self: center;
    padding-top: 0;
  }

  .line-remove {
    align-self: center;
  }
}
</style>
