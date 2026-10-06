<script setup lang="ts">
import { ref } from 'vue'

import { confirmDialog } from '@shared/ui/useConfirm'
import { useProductsStore } from '@shared/stores/products'
import type { Product, Variation, VariationOption } from '@shared/db/types'

const props = defineProps<{
  /** Saved product — variations require a persisted id. */
  product: Product
}>()

const store = useProductsStore()

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

async function removeVariation(variation: Variation) {
  const ok = await confirmDialog(
    `Remove variation "${variation.name}"? SKUs that use it will be deleted.`,
    'Remove variation',
  )
  if (!ok) return
  store.removeVariation(variation.id)
}

function addOption(variation: Variation) {
  const label = draftFor(variation.id).trim()
  if (!label) return
  store.addOption(variation.id, label)
  optionDrafts.value = { ...optionDrafts.value, [variation.id]: '' }
}

async function removeOption(variation: Variation, option: VariationOption) {
  const ok = await confirmDialog(
    `Remove option "${option.label}" from ${variation.name}? SKUs that use it will be deleted.`,
    'Remove option',
  )
  if (!ok) return
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
          :aria-label="`New option for ${variation.name}`"
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
        aria-label="New variation name"
        @keydown.enter.prevent="addVariation"
      />
      <button type="button" class="btn" @click="addVariation">Add variation</button>
    </div>
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
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-ink-soft);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

/* Touch: grow the hit area to 44px without changing the chip's size. */
@media (pointer: coarse) {
  .chip-remove::after {
    content: '';
    position: absolute;
    inset: -10px;
  }
}

.chip-remove:hover {
  color: var(--color-danger);
}

.option-add {
  max-width: 380px;
}

.variation-add {
  max-width: 380px;
  margin-bottom: 0;
}
</style>
