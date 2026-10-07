<script setup lang="ts">
import type { SaleFilter } from '../lib/saleSummary'

defineProps<{
  counts: Record<SaleFilter, number>
}>()

const filter = defineModel<SaleFilter>({ required: true })

const CHIPS: { value: SaleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'undelivered', label: 'Undelivered' },
]
</script>

<template>
  <div class="filter-chips" role="group" aria-label="Filter sales">
    <button
      v-for="chip in CHIPS"
      :key="chip.value"
      type="button"
      class="filter-chip"
      :aria-pressed="filter === chip.value"
      @click="filter = chip.value"
    >
      {{ chip.label }}
      <span class="chip-count">{{ counts[chip.value] }}</span>
    </button>
  </div>
</template>

<style scoped>
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-control-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

/* Pressed: tonal fill plus a doubled border, so it is not told apart by hue alone. */
.filter-chip[aria-pressed='true'] {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary);
  color: var(--color-primary-ink);
}

.filter-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.chip-count {
  min-width: 1.5em;
  padding: 0 0.4em;
  border-radius: 999px;
  background: var(--color-bg);
  color: var(--color-ink-soft);
  font-size: 0.8rem;
  text-align: center;
}

.filter-chip[aria-pressed='true'] .chip-count {
  background: var(--color-surface);
  color: var(--color-primary-ink);
}

@media (pointer: coarse) {
  .filter-chip {
    min-height: 44px;
  }
}
</style>
