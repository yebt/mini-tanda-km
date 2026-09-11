<script setup lang="ts">
import { useConfirmHost } from '@shared/ui/useConfirm'

const { pending, accept, dismiss } = useConfirmHost()
</script>

<template>
  <Teleport to="body">
    <div v-if="pending" class="confirm-overlay" @click.self="dismiss">
      <div class="confirm-dialog" role="alertdialog" aria-modal="true">
        <p class="confirm-message">{{ pending.message }}</p>
        <div class="row confirm-actions">
          <button type="button" class="btn" @click="dismiss">Cancel</button>
          <button type="button" class="btn btn-primary" @click="accept">
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
  background: rgb(43 33 24 / 45%);
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
}

.confirm-message {
  margin: 0 0 var(--space-4);
  white-space: pre-line;
}

.confirm-actions {
  justify-content: flex-end;
}
</style>
