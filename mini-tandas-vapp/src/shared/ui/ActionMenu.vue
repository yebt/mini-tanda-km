<script setup lang="ts">
import { ref } from 'vue'

import { MoreVertical } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    /** Show the "Edit" item. Default true. */
    showEdit?: boolean
    /** Show the "Delete" item. Default true. */
    showRemove?: boolean
    /** Show a "Record payment" item. Default false. */
    showPay?: boolean
  }>(),
  { showEdit: true, showRemove: true, showPay: false },
)

const emit = defineEmits<{
  edit: []
  remove: []
  pay: []
}>()

const open = ref(false)

function close() {
  open.value = false
}

function onEdit() {
  close()
  emit('edit')
}

function onRemove() {
  close()
  emit('remove')
}

function onPay() {
  close()
  emit('pay')
}
</script>

<template>
  <div class="action-menu">
    <button
      type="button"
      class="kebab"
      aria-label="Actions"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click.stop="open = !open"
      @keydown.escape.prevent="close"
    >
      <MoreVertical :size="18" />
    </button>
    <div v-if="open" class="menu-backdrop" @click="close" />
    <div v-if="open" class="menu" role="menu">
      <button v-if="props.showPay" type="button" role="menuitem" class="menu-item" @click="onPay">
        Record payment
      </button>
      <button v-if="props.showEdit" type="button" role="menuitem" class="menu-item" @click="onEdit">
        Edit
      </button>
      <button
        v-if="props.showRemove"
        type="button"
        role="menuitem"
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
  min-width: 140px;
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
  color: var(--color-primary);
}

.menu-item-danger {
  color: var(--color-danger);
}

.menu-item-danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
</style>
