<script setup lang="ts">
import { computed, ref } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { Product, Variation, VariationOption } from '@shared/db/types'

import SkuPriceTable from './SkuPriceTable.vue'

const props = defineProps<{
  /** Saved product — variations require a persisted id. */
  product: Product
}>()

const store = useProductsStore()

const skus = computed(
  () => store.catalog.find((entry) => entry.product.id === props.product.id)?.skus ?? [],
)

const newVariationName = ref('')
const optionDrafts = ref<Record<string, string>>({})

function draftFor(variationId: string): string {
  return optionDrafts.value[variationId] ?? ''
}

function setDraft(variationId: string, event: Event) {
  const value = (event.target as HTMLInputElement).value
  optionDrafts.value = { ...optionDrafts.value, [variationId]: value }
}

function addVariation() {
  const name = newVariationName.value.trim()
  if (!name) return
  store.addVariation(props.product.id, name)
  newVariationName.value = ''
}

function removeVariation(variation: Variation) {
  if (!confirm(`Remove variation "${variation.name}"? SKUs that use it will be deleted.`)) return
  store.removeVariation(variation.id)
}

function addOption(variation: Variation) {
  const label = draftFor(variation.id).trim()
  if (!label) return
  store.addOption(variation.id, label)
  optionDrafts.value = { ...optionDrafts.value, [variation.id]: '' }
}

function removeOption(variation: Variation, option: VariationOption) {
  if (
    !confirm(
      `Remove option "${option.label}" from ${variation.name}? SKUs that use it will be deleted.`,
    )
  )
    return
  store.removeOption(option.id)
}
</script>

<template>
  <section class="variation-editor">
    <h3>Variations</h3>
    <p class="muted">
      Variations generate SKUs automatically — e.g. FLAVOR (Coffee, Chocolate) × SIZE (Personal,
      Family).
    </p>

    <div v-for="variation in product.variations" :key="variation.id" class="card variation-card">
      <div class="row-between">
        <strong class="variation-name">{{ variation.name }}</strong>
        <button type="button" class="btn btn-danger" @click="removeVariation(variation)">
          Remove variation
        </button>
      </div>

      <div class="row-wrap option-chips">
        <span v-for="option in variation.options" :key="option.id" class="option-chip">
          {{ option.label }}
          <button
            type="button"
            class="chip-remove"
            :aria-label="`Remove ${option.label}`"
            @click="removeOption(variation, option)"
          >
            ×
          </button>
        </span>
        <span v-if="variation.options.length === 0" class="muted">No options yet.</span>
      </div>

      <div class="row option-add">
        <input
          type="text"
          class="input"
          placeholder="New option, e.g. Coffee"
          :value="draftFor(variation.id)"
          @input="setDraft(variation.id, $event)"
          @keydown.enter.prevent="addOption(variation)"
        />
        <button type="button" class="btn" @click="addOption(variation)">Add option</button>
      </div>
    </div>

    <div class="row variation-add">
      <input
        v-model="newVariationName"
        type="text"
        class="input"
        placeholder="New variation, e.g. SIZE"
        @keydown.enter.prevent="addVariation"
      />
      <button type="button" class="btn" @click="addVariation">Add variation</button>
    </div>

    <SkuPriceTable v-if="product.priceMode === 'per_sku'" :skus="skus" />
    <p v-else class="muted sku-note">SKUs sell at the global product price.</p>
  </section>
</template>

<style scoped>
.variation-editor h3 {
  margin-top: 0;
}

.variation-card {
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  box-shadow: none;
}

.variation-name {
  text-transform: capitalize;
}

.option-chips {
  margin: var(--space-3) 0;
}

.option-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.15rem 0.3rem 0.15rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.85rem;
}

.chip-remove {
  border: none;
  background: transparent;
  color: var(--color-ink-soft);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.3rem;
}

.chip-remove:hover {
  color: var(--color-danger);
}

.option-add {
  max-width: 380px;
}

.variation-add {
  max-width: 380px;
  margin-bottom: var(--space-4);
}

.sku-note {
  margin-bottom: 0;
}
</style>
