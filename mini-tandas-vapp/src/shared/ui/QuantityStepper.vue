<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'

/**
 * Whole-number quantity control: − / input / + in one bordered group.
 * The value is always kept within [min, max]: typed values above `max` are
 * capped as you type; empty, fractional or below-`min` text is reverted when
 * the input commits (change / Enter).
 */
const props = withDefaults(
  defineProps<{
    /** Accessible name of the number input, e.g. "Quantity". */
    label: string
    decreaseLabel: string
    increaseLabel: string
    min?: number
    /** Upper bound; omit for no limit. */
    max?: number
    size?: 'md' | 'sm'
    inputId?: string
  }>(),
  { min: 1, max: Number.POSITIVE_INFINITY, size: 'md', inputId: undefined },
)

const model = defineModel<number>({ required: true })

const emit = defineEmits<{
  /** Enter pressed in the input (after the typed value is committed). */
  enter: []
}>()

/** `min` wins over a `max` below it (e.g. a stock cap of 0). */
function clamp(value: number): number {
  return Math.max(props.min, Math.min(value, props.max))
}

function set(value: number) {
  const next = clamp(value)
  if (next !== model.value) model.value = next
}

function step(delta: number) {
  const base = Number.isInteger(model.value) ? model.value : props.min
  set(base + delta)
}

function parse(text: string): number | null {
  const value = Number(text)
  return text.trim() !== '' && Number.isInteger(value) ? value : null
}

function onInput(event: Event) {
  const value = parse((event.target as HTMLInputElement).value)
  // Values below the minimum may be the start of a longer number: wait for commit.
  if (value !== null && value >= props.min) set(value)
}

/**
 * Show the committed value: capped at `max`, or the previous value when the
 * text is not a whole number of at least `min`.
 */
function commit(event: Event) {
  const input = event.target as HTMLInputElement
  const value = parse(input.value)
  if (value !== null && value >= props.min) set(value)
  input.value = String(model.value)
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowUp':
      step(1)
      break
    case 'ArrowDown':
      step(-1)
      break
    case 'Home':
      set(props.min)
      break
    case 'End':
      if (Number.isFinite(props.max)) set(props.max)
      else return
      break
    case 'Enter':
      commit(event)
      emit('enter')
      break
    default:
      return
  }
  event.preventDefault()
}
</script>

<template>
  <div class="qty-stepper" :class="`qty-stepper-${size}`">
    <button
      type="button"
      class="qty-btn"
      :aria-label="decreaseLabel"
      :disabled="model <= min"
      @click="step(-1)"
    >
      <Minus :size="size === 'sm' ? 14 : 16" aria-hidden="true" />
    </button>
    <input
      :id="inputId"
      class="qty-input"
      type="number"
      inputmode="numeric"
      step="1"
      :min="min"
      :max="Number.isFinite(max) ? max : undefined"
      :value="model"
      :aria-label="label"
      @input="onInput"
      @change="commit"
      @keydown="onKeydown"
    />
    <button
      type="button"
      class="qty-btn"
      :aria-label="increaseLabel"
      :disabled="model >= max"
      @click="step(1)"
    >
      <Plus :size="size === 'sm' ? 14 : 16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
/* One bordered group; the parts share its height and have no borders of their own. */
.qty-stepper {
  --qty-height: 44px;
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
  height: var(--qty-height);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-small);
  background: var(--color-surface);
}

.qty-stepper-sm {
  --qty-height: 36px;
}

/* Typing in the input: ring the whole group, like a text field. */
.qty-stepper:has(.qty-input:focus) {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.qty-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--qty-height);
  padding: 0;
  border: 0;
  border-radius: calc(var(--radius-small) - 1px);
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
  transition:
    background-color 0.12s ease-out,
    color 0.12s ease-out;
}

.qty-btn:hover:not(:disabled) {
  background: var(--color-primary-soft);
  color: var(--color-primary-ink);
}

.qty-btn:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: -2px;
}

.qty-btn:disabled {
  color: var(--color-ink-soft);
  opacity: 0.5;
  cursor: not-allowed;
}

.qty-input {
  width: 3.25rem;
  min-width: 0;
  padding: 0 var(--space-1);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}

.qty-stepper-sm .qty-input {
  width: 2.75rem;
}

.qty-input:focus {
  outline: none;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Touch: every part stays at least 44px. */
@media (pointer: coarse) {
  .qty-stepper-sm {
    --qty-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .qty-btn {
    transition: none;
  }
}
</style>
