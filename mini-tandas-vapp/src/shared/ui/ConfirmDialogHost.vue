<script setup lang="ts">
import { useId, useTemplateRef, watch } from 'vue'

import { useConfirmHost } from '@shared/ui/useConfirm'
import { useDialogFocus } from '@shared/ui/useDialogFocus'
import { lockScroll, unlockScroll } from '@shared/ui/useScrollLock'

const { pending, accept, dismiss } = useConfirmHost()

const titleId = useId()
const messageId = useId()
const dialog = useTemplateRef<HTMLElement>('dialog')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')

// Confirms guard destructive actions: start on Cancel, Escape dismisses.
useDialogFocus({
  container: dialog,
  active: () => pending.value !== null,
  onEscape: dismiss,
  initialFocus: () => cancelButton.value,
})

watch(
  pending,
  (value) => {
    if (value) lockScroll()
    else unlockScroll()
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="pending" class="confirm-overlay" @click.self="dismiss">
      <div
        ref="dialog"
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="messageId"
        tabindex="-1"
      >
        <h2 :id="titleId" class="visually-hidden">Please confirm</h2>
        <p :id="messageId" class="confirm-message">{{ pending.message }}</p>
        <div class="row confirm-actions">
          <button ref="cancelButton" type="button" class="btn" @click="dismiss">Cancel</button>
          <button
            type="button"
            class="btn"
            :class="pending.tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'"
            @click="accept"
          >
            {{ pending.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 100;
}

.confirm-dialog {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--space-6);
  max-width: 380px;
  width: 100%;
  overscroll-behavior: contain;
}

.confirm-message {
  margin: 0 0 var(--space-4);
  white-space: pre-line;
}

/* Cancel sits on the left, away from the confirm action (Fitts / LAW-02). */
.confirm-actions {
  justify-content: space-between;
  flex-wrap: wrap;
}
</style>
