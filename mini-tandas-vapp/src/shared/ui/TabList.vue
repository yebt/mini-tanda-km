<script lang="ts">
/** Id of the tab button for `value` (pair it with the panel's `aria-labelledby`). */
export function tabId(idBase: string, value: string): string {
  return `${idBase}-tab-${value}`
}

/** Id of the tab panel for `value` (the parent renders the `role="tabpanel"`). */
export function panelId(idBase: string, value: string): string {
  return `${idBase}-panel-${value}`
}
</script>

<script setup lang="ts">
import { nextTick } from 'vue'

export interface TabItem {
  value: string
  label: string
}

/**
 * WAI-ARIA tabs (automatic activation): one tab stop, arrow keys / Home /
 * End move and select. The parent renders the matching panel with
 * `role="tabpanel"`, `id=panelId(...)` and `aria-labelledby=tabId(...)`.
 */
const props = defineProps<{
  tabs: readonly TabItem[]
  modelValue: string
  /** Prefix for tab and panel ids; unique per page. */
  idBase: string
  /** Accessible name for the tab list. */
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function select(value: string): void {
  if (value !== props.modelValue) emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent, index: number): void {
  const count = props.tabs.length
  let next: number
  switch (event.key) {
    case 'ArrowRight':
      next = (index + 1) % count
      break
    case 'ArrowLeft':
      next = (index - 1 + count) % count
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = count - 1
      break
    default:
      return
  }
  event.preventDefault()
  const tab = props.tabs[next]!
  select(tab.value)
  void nextTick(() => document.getElementById(tabId(props.idBase, tab.value))?.focus())
}
</script>

<template>
  <div class="tabs" role="tablist" :aria-label="label">
    <button
      v-for="(tab, index) in tabs"
      :id="tabId(idBase, tab.value)"
      :key="tab.value"
      type="button"
      role="tab"
      class="tab"
      :class="{ 'is-active': tab.value === modelValue }"
      :aria-selected="tab.value === modelValue"
      :aria-controls="panelId(idBase, tab.value)"
      :tabindex="tab.value === modelValue ? 0 : -1"
      @click="select(tab.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-4);
}

.tab {
  border: none;
  background: transparent;
  padding: var(--space-2) var(--space-3);
  min-height: 44px;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-ink-soft);
  cursor: pointer;
}

.tab:hover {
  color: var(--color-primary);
}

.tab.is-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
</style>
