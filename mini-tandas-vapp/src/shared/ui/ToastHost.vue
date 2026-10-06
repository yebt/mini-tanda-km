<script setup lang="ts">
import { X } from 'lucide-vue-next'

import { dismissToast, runToastAction, toasts } from './useToast'
</script>

<template>
  <!-- Always rendered: a live region must exist before its content changes. -->
  <div class="toast-region" role="status" aria-live="polite">
    <div v-for="toast in toasts" :key="toast.id" class="toast">
      <span class="toast-message">{{ toast.message }}</span>
      <button
        v-if="toast.action"
        type="button"
        class="toast-action"
        @click="runToastAction(toast)"
      >
        {{ toast.action.label }}
      </button>
      <button
        type="button"
        class="toast-dismiss"
        aria-label="Dismiss notification"
        @click="dismissToast(toast.id)"
      >
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-region {
  position: fixed;
  left: 50%;
  bottom: var(--space-4);
  transform: translateX(-50%);
  z-index: 150;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(28rem, calc(100% - 2 * var(--space-4)));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius);
  background: var(--color-ink);
  color: var(--color-bg);
  box-shadow: var(--shadow-fab);
  font-size: 0.9rem;
  pointer-events: auto;
}

.toast-message {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.toast-action,
.toast-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  min-width: 32px;
  padding: 0 var(--space-2);
  border: none;
  border-radius: var(--radius-small);
  background: transparent;
  color: inherit;
  font-weight: 700;
  cursor: pointer;
}

.toast-action {
  text-decoration: underline;
}

.toast-action:hover,
.toast-dismiss:hover {
  background: rgb(255 255 255 / 15%);
}

.toast-action:focus-visible,
.toast-dismiss:focus-visible {
  outline: 2px solid currentcolor;
  outline-offset: 1px;
}

@media (pointer: coarse) {
  .toast-action,
  .toast-dismiss {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Mobile: sit above the bottom nav and the FAB. */
@media (max-width: 720px) {
  .toast-region {
    bottom: calc(
      var(--nav-bottom-height) + var(--safe-bottom) + var(--fab-size) + var(--space-6)
    );
  }
}
</style>
