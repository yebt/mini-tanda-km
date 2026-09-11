<script setup lang="ts">
defineOptions({ name: 'SearchCombobox' })

import { computed, ref, watch } from 'vue'

export interface ComboOption {
  value: string
  label: string
  hint?: string
  disabled?: boolean
  disabledReason?: string
}

const props = defineProps<{
  modelValue: string
  options: ComboOption[]
  inputId?: string
  placeholder?: string
  ariaLabel?: string
  /** Show a "Create …" row when the query matches no existing option. */
  allowCreate?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  create: [query: string]
}>()

const open = ref(false)
const query = ref('')

const selected = computed(() => props.options.find((o) => o.value === props.modelValue) ?? null)

/** Sync the input text with the selected option (also on external resets). */
watch(
  () => props.modelValue,
  (value) => {
    query.value = props.options.find((o) => o.value === value)?.label ?? ''
  },
  { immediate: true },
)

const MAX_RESULTS = 20

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const matches = q ? props.options.filter((o) => o.label.toLowerCase().includes(q)) : props.options
  return matches.slice(0, MAX_RESULTS)
})

const exactMatch = computed(() =>
  filtered.value.some((o) => o.label.toLowerCase() === query.value.trim().toLowerCase()),
)

const showCreate = computed(
  () =>
    props.allowCreate &&
    query.value.trim() !== '' &&
    !exactMatch.value &&
    filtered.value.every((o) => o.label.toLowerCase() !== query.value.trim().toLowerCase()),
)

function openList() {
  open.value = true
}

function closeList() {
  open.value = false
}

function pick(option: ComboOption) {
  if (option.disabled) return
  query.value = option.label
  emit('update:modelValue', option.value)
  closeList()
}

function onInput() {
  open.value = true
  // Typing replaces the current selection.
  if (props.modelValue) emit('update:modelValue', '')
}

function onBlur() {
  // If the text no longer matches the selection, drop it.
  if (props.modelValue && query.value !== selected.value?.label) {
    query.value = selected.value?.label ?? ''
  }
}

function createFromQuery() {
  const q = query.value.trim()
  if (!q) return
  emit('create', q)
  closeList()
}

/** Reset to blank (e.g. after the parent consumed the selection). */
function clear() {
  query.value = ''
  emit('update:modelValue', '')
}

defineExpose({ clear })
</script>

<template>
  <div class="combo">
    <input
      :id="inputId"
      v-model="query"
      class="input combo-input"
      type="text"
      role="combobox"
      :aria-expanded="open"
      aria-autocomplete="list"
      :aria-label="ariaLabel"
      :placeholder="placeholder"
      @input="onInput"
      @focus="openList"
      @blur="onBlur"
      @keydown.escape.prevent="closeList"
      @keydown.down.prevent="openList"
    />
    <div v-if="open" class="combo-backdrop" @click="closeList" @mousedown.prevent />
    <div v-if="open" class="combo-list" role="listbox">
      <button
        v-for="option in filtered"
        :key="option.value"
        type="button"
        role="option"
        class="combo-option"
        :class="{ 'is-selected': option.value === modelValue, 'is-disabled': option.disabled }"
        :aria-disabled="option.disabled || undefined"
        @click="pick(option)"
      >
        <span class="option-label">{{ option.label }}</span>
        <span v-if="option.disabled && option.disabledReason" class="option-hint">
          {{ option.disabledReason }}
        </span>
        <span v-else-if="option.hint" class="option-hint">{{ option.hint }}</span>
      </button>
      <p v-if="filtered.length === 0 && !showCreate" class="combo-empty muted">No matches.</p>
      <button
        v-if="showCreate"
        type="button"
        role="option"
        class="combo-option combo-create"
        @click="createFromQuery"
      >
        + Create "{{ query.trim() }}"
      </button>
    </div>
  </div>
</template>

<style scoped>
.combo {
  position: relative;
}

.combo-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.combo-list {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  right: 0;
  z-index: 41;
  max-height: 16rem;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  box-shadow: var(--shadow);
  padding: var(--space-1);
  display: flex;
  flex-direction: column;
}

.combo-option {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  border: none;
  background: transparent;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-small);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-ink);
  cursor: pointer;
}

.combo-option:hover,
.combo-option.is-selected {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.combo-option.is-disabled {
  color: var(--color-ink-soft);
  cursor: not-allowed;
  opacity: 0.6;
}

.combo-option.is-disabled:hover {
  background: transparent;
  color: var(--color-ink-soft);
}

.option-hint {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-ink-soft);
  white-space: nowrap;
}

.combo-create {
  color: var(--color-primary);
}

.combo-empty {
  padding: var(--space-2) var(--space-3);
  margin: 0;
}
</style>
