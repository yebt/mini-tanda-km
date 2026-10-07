<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'

import { MoreVertical } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    /** Show the "Edit" item. Default true. */
    showEdit?: boolean
    /** Show the "Delete" item. Default true. */
    showRemove?: boolean
    /** Show a "Record payment" item. Default false. */
    showPay?: boolean
    /** Label of the edit item (e.g. "Rename" when only the name can change). */
    editLabel?: string
  }>(),
  { showEdit: true, showRemove: true, showPay: false, editLabel: 'Edit' },
)

const emit = defineEmits<{
  edit: []
  remove: []
  pay: []
}>()

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const menu = useTemplateRef<HTMLElement>('menu')

function items(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
}

/** Open and move focus into the menu (WAI-ARIA menu button pattern). */
async function openMenu(focus: 'first' | 'last' = 'first') {
  open.value = true
  await nextTick()
  const list = items()
  ;(focus === 'first' ? list[0] : list[list.length - 1])?.focus()
}

function close(returnFocus = false) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else void openMenu()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    void openMenu(event.key === 'ArrowDown' ? 'first' : 'last')
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close()
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  const list = items()
  const index = list.indexOf(document.activeElement as HTMLElement)
  let next: number | null = null
  switch (event.key) {
    case 'ArrowDown':
      next = (index + 1) % list.length
      break
    case 'ArrowUp':
      next = (index - 1 + list.length) % list.length
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = list.length - 1
      break
    case 'Escape':
      // Handled here so an enclosing dialog does not also close.
      event.preventDefault()
      close(true)
      return
    case 'Tab':
      // Let focus move on naturally; the menu does not stay open behind it.
      close()
      return
    default:
      return
  }
  event.preventDefault()
  list[next]?.focus()
}

/**
 * Close when keyboard focus moves outside the trigger and the menu. A null
 * target (pointer press on a non-focusing control, as in Safari) is left to
 * the backdrop so mouse picks still land on the item.
 */
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || root.value?.contains(next)) return
  close()
}

function onEdit() {
  close(true)
  emit('edit')
}

function onRemove() {
  close(true)
  emit('remove')
}

function onPay() {
  close(true)
  emit('pay')
}
</script>

<template>
  <div ref="root" class="action-menu" @focusout="onFocusOut">
    <button
      ref="trigger"
      type="button"
      class="kebab"
      aria-label="Actions"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click.stop="toggle"
      @keydown="onTriggerKeydown"
    >
      <MoreVertical :size="18" aria-hidden="true" />
    </button>
    <div v-if="open" class="menu-backdrop" @click="close()" />
    <div v-if="open" ref="menu" class="menu" role="menu" @keydown="onMenuKeydown">
      <button v-if="props.showPay" type="button" role="menuitem" tabindex="-1" class="menu-item" @click="onPay">
        Record payment
      </button>
      <button v-if="props.showEdit" type="button" role="menuitem" tabindex="-1" class="menu-item" @click="onEdit">
        {{ props.editLabel }}
      </button>
      <button
        v-if="props.showRemove"
        type="button"
        role="menuitem"
        tabindex="-1"
        class="menu-item menu-item-danger"
        @click="onRemove"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-menu {
  position: relative;
  flex-shrink: 0;
}

.kebab {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
  border: none;
  background: transparent;
  color: var(--color-ink-soft);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-small);
  cursor: pointer;
}

.kebab:hover,
.kebab[aria-expanded='true'] {
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

@media (pointer: coarse) {
  .kebab {
    min-width: 44px;
    min-height: 44px;
  }

  .menu-item {
    min-height: 44px;
  }
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.menu {
  position: absolute;
  right: 0;
  top: calc(100% + var(--space-1));
  z-index: 41;
  /* min-width: 140px; */
  min-width: max-content;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  box-shadow: var(--shadow);
  padding: var(--space-1);
  display: flex;
  flex-direction: column;
}

.menu-item {
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

.menu-item:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary-ink);
}

.menu-item-danger {
  color: var(--color-danger);
}

.menu-item-danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
</style>
