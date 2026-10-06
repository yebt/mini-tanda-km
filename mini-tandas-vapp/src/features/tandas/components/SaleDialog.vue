<script setup lang="ts">
import { useId, useTemplateRef } from 'vue'

import type { SaleWithDetails, TandaType } from '@shared/db/types'
import { confirmDialog } from '@shared/ui/useConfirm'
import { useDialogFocus } from '@shared/ui/useDialogFocus'
import { useScrollLock } from '@shared/ui/useScrollLock'

import SaleForm from './SaleForm.vue'

defineProps<{
  tandaId: string
  type: TandaType
  /** SKU pre-selected when the dialog opens (e.g. sold from the inventory). */
  initialSkuId?: string
  /** Sale being edited; when set, the dialog opens the form in edit mode. */
  initialSale?: SaleWithDetails
}>()

useScrollLock()

const emit = defineEmits<{
  close: []
}>()

const form = useTemplateRef<{ draftSize?: () => number }>('form')
let asking = false

/** Close after a save: nothing left to protect. */
function onSubmitted() {
  emit('close')
}

/** Backdrop, × or Escape: ask before throwing away drafted lines. */
async function requestClose() {
  if (asking) return
  const size = form.value?.draftSize?.() ?? 0
  if (size > 0) {
    asking = true
    const ok = await confirmDialog(
      `Discard this sale? ${size === 1 ? 'The item' : `The ${size} items`} you added will be lost.`,
      'Discard',
      { tone: 'danger' },
    )
    asking = false
    if (!ok) return
  }
  emit('close')
}

const titleId = useId()
const sheet = useTemplateRef<HTMLElement>('sheet')
useDialogFocus({ container: sheet, onEscape: requestClose })
</script>

<template>
  <Teleport to="body">
    <div class="dialog-backdrop" @click="requestClose">
      <div
        ref="sheet"
        class="dialog-sheet"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @click.stop
      >
        <button type="button" class="dialog-close" aria-label="Close" @click="requestClose">
          ×
        </button>
        <SaleForm
          ref="form"
          :tanda-id="tandaId"
          :type="type"
          :initial-sku-id="initialSkuId"
          :initial-sale="initialSale"
          :title-id="titleId"
          @submitted="onSubmitted"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--color-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.dialog-sheet {
  position: relative;
  width: 100%;
  max-width: 34rem;
  max-height: calc(100dvh - var(--space-8));
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-bg);
  border-radius: var(--radius);
}

.dialog-sheet :deep(.sale-form) {
  margin-bottom: 0;
  border: none;
  box-shadow: none;
}

.dialog-close {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 1;
  border: none;
  background: transparent;
  color: var(--color-ink-soft);
  font-size: 1.4rem;
  line-height: 1;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-small);
  cursor: pointer;
}

@media (pointer: coarse) {
  .dialog-close {
    min-width: 44px;
    min-height: 44px;
  }
}

.dialog-close:hover {
  color: var(--color-ink);
  background: var(--color-primary-soft);
}

/* Mobile: bottom sheet sliding up from the nav bar. */
@media (max-width: 720px) {
  .dialog-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .dialog-sheet {
    max-width: none;
    max-height: 85dvh;
    border-radius: var(--radius) var(--radius) 0 0;
    padding-bottom: calc(var(--space-4) + var(--safe-bottom));
  }
}
</style>
