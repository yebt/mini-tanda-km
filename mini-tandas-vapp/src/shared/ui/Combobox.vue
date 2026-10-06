<script setup lang="ts">
defineOptions({ name: 'SearchCombobox' })

import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

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
/** Index into `items` of the keyboard-highlighted option (-1 = none). */
const activeIndex = ref(-1)
const listId = useId()

const root = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
/** Fixed viewport position for the teleported dropdown. */
const listStyle = ref({ top: '0px', left: '0px', width: '0px' })

/**
 * The dropdown renders in a Teleport (see template) so it can escape overflow
 * containers like the sale dialog sheet. Its fixed position is computed from
 * the input's viewport rect and flips above the input when space runs out.
 */
async function positionList() {
  await nextTick()
  const input = root.value?.querySelector('input')
  if (!input) return
  const rect = input.getBoundingClientRect()
  const listHeight = listEl.value?.offsetHeight ?? 0
  const gap = 4
  const fitsBelow = rect.bottom + gap + listHeight <= window.innerHeight
  const top = fitsBelow ? rect.bottom + gap : Math.max(gap, rect.top - gap - listHeight)
  listStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(rect.left)}px`,
    width: `${Math.round(rect.width)}px`,
  }
}

watch(open, (value) => {
  if (value) positionList()
})

function onViewportChange() {
  if (open.value) positionList()
}

window.addEventListener('resize', onViewportChange)
window.addEventListener('scroll', onViewportChange, true)
onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

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

// The dropdown height changes with the filtered results — keep it anchored.
watch(filtered, () => {
  if (open.value) positionList()
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

/** Every row of the listbox (options, then the optional "Create" row), with stable ids. */
const items = computed(() => {
  const rows: { id: string; option: ComboOption | null; disabled: boolean }[] = filtered.value.map(
    (option, index) => ({
      id: `${listId}-option-${index}`,
      option,
      disabled: option.disabled === true,
    }),
  )
  if (showCreate.value) rows.push({ id: `${listId}-create`, option: null, disabled: false })
  return rows
})

const activeId = computed(() =>
  open.value && activeIndex.value >= 0 ? items.value[activeIndex.value]?.id : undefined,
)

// New results invalidate the highlighted row.
watch(items, () => {
  activeIndex.value = -1
})

function openList() {
  open.value = true
}

function closeList() {
  open.value = false
  activeIndex.value = -1
}

/** Highlight the next enabled row in `direction` (wrapping from "none" to the ends). */
function moveActive(direction: 1 | -1) {
  const rows = items.value
  let index = activeIndex.value
  for (let step = 0; step < rows.length; step++) {
    index = index < 0 ? (direction === 1 ? 0 : rows.length - 1) : index + direction
    if (index < 0 || index >= rows.length) return
    if (!rows[index]!.disabled) {
      activeIndex.value = index
      void nextTick(() => {
        document.getElementById(rows[index]!.id)?.scrollIntoView?.({ block: 'nearest' })
      })
      return
    }
  }
}

function onArrow(direction: 1 | -1) {
  if (!open.value) openList()
  moveActive(direction)
}

/** Enter picks the highlighted row; otherwise it bubbles (e.g. to "add line"). */
function onEnter(event: KeyboardEvent) {
  if (!open.value || activeIndex.value < 0) return
  const row = items.value[activeIndex.value]
  if (!row) return
  event.preventDefault()
  event.stopPropagation()
  if (row.option) pick(row.option)
  else createFromQuery()
}

/** Escape closes the list only; when it is already closed it reaches the dialog. */
function onEscape(event: KeyboardEvent) {
  if (!open.value) return
  event.preventDefault()
  closeList()
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

/** Focus the input for typing continuity without dropping the open backdrop
 *  over the page (the focus event would otherwise open the list). */
function focus() {
  root.value?.querySelector('input')?.focus()
  open.value = false
}

defineExpose({ clear, focus })
</script>

<template>
  <div ref="root" class="combo">
    <input
      :id="inputId"
      v-model="query"
      class="input combo-input"
      type="text"
      role="combobox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="activeId"
      aria-autocomplete="list"
      :aria-label="ariaLabel"
      :placeholder="placeholder"
      autocomplete="off"
      @input="onInput"
      @focus="openList"
      @blur="onBlur"
      @keydown.escape="onEscape"
      @keydown.down.prevent="onArrow(1)"
      @keydown.up.prevent="onArrow(-1)"
      @keydown.enter="onEnter"
    />
    <Teleport to="body">
      <div v-if="open" class="combo-backdrop" @click="closeList" @mousedown.prevent />
      <!-- Kept in the DOM (v-show) so the input's aria-controls always resolves. -->
      <div
        v-show="open"
        :id="listId"
        ref="listEl"
        class="combo-list"
        role="listbox"
        :style="listStyle"
        @mousedown.prevent
      >
        <div
          v-for="(option, index) in filtered"
          :id="items[index]?.id"
          :key="option.value"
          role="option"
          class="combo-option"
          :class="{
            'is-selected': option.value === modelValue,
            'is-active': index === activeIndex,
            'is-disabled': option.disabled,
          }"
          :aria-selected="option.value === modelValue"
          :aria-disabled="option.disabled || undefined"
          @click="pick(option)"
        >
          <span class="option-label">{{ option.label }}</span>
          <span v-if="option.disabled && option.disabledReason" class="option-hint">
            {{ option.disabledReason }}
          </span>
          <span v-else-if="option.hint" class="option-hint">{{ option.hint }}</span>
        </div>
        <p v-if="filtered.length === 0 && !showCreate" class="combo-empty muted">No matches.</p>
        <div
          v-if="showCreate"
          :id="`${listId}-create`"
          role="option"
          class="combo-option combo-create"
          :class="{ 'is-active': activeIndex === filtered.length }"
          :aria-selected="false"
          @click="createFromQuery"
        >
          + Create "{{ query.trim() }}"
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.combo {
  position: relative;
}

.combo-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
}

.combo-list {
  position: fixed;
  z-index: 81;
  max-height: 16rem;
  overflow-y: auto;
  overscroll-behavior: contain;
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
.combo-option.is-selected,
.combo-option.is-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

/* The keyboard-highlighted row also gets a ring, distinct from hover/selection. */
.combo-option.is-active {
  box-shadow: inset 0 0 0 2px var(--color-primary);
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
