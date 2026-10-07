<script setup lang="ts">
import { computed, ref, useId, useTemplateRef, watch } from 'vue'

import { useClientsStore } from '@shared/stores/clients'
import { useBackToClose } from '@shared/ui/useBackToClose'
import { useDialogFocus } from '@shared/ui/useDialogFocus'
import { useScrollLock } from '@shared/ui/useScrollLock'
import { notify } from '@shared/ui/useToast'

const props = defineProps<{
  client: { id: string; name: string }
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useClientsStore()

/** Name when the dialog opened (the prop updates as soon as the rename lands). */
const original = props.client.name
const name = ref(original)
const error = ref('')
/** Name of the other client the typed name collides with, once warned. */
const duplicateOf = ref<string | null>(null)

// Editing the text withdraws a previous warning or error.
watch(name, () => {
  error.value = ''
  duplicateOf.value = null
})

const titleId = useId()
const errorId = useId()
const warningId = useId()

const describedBy = computed(
  () => [error.value ? errorId : null, duplicateOf.value ? warningId : null].filter(Boolean).join(' ') || undefined,
)

const input = useTemplateRef<HTMLInputElement>('input')

function submit(): void {
  const value = name.value.trim()
  if (value === original) {
    emit('close')
    return
  }
  // A same-name client is allowed (two Anas exist), but only on purpose.
  const other = value ? store.nameTakenBy(value, props.client.id) : null
  if (other && duplicateOf.value === null) {
    duplicateOf.value = other.name
    return
  }
  const result = store.renameClient(props.client.id, value)
  if (!result.ok) {
    error.value = result.error
    input.value?.focus()
    return
  }
  notify(`Renamed "${original}" to "${value}".`)
  emit('close')
}

function cancel(): true {
  emit('close')
  return true
}

useScrollLock()
useBackToClose(cancel)
const dialog = useTemplateRef<HTMLElement>('dialog')
useDialogFocus({ container: dialog, onEscape: cancel, initialFocus: () => input.value })
</script>

<template>
  <Teleport to="body">
    <div class="rename-overlay" @click.self="cancel">
      <div
        ref="dialog"
        class="rename-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <h2 :id="titleId">Rename client</h2>
        <form novalidate @submit.prevent="submit">
          <div class="field">
            <label class="label" for="rename-client-name">Name</label>
            <input
              id="rename-client-name"
              ref="input"
              v-model="name"
              class="input"
              type="text"
              autocomplete="off"
              aria-required="true"
              :aria-invalid="error ? 'true' : undefined"
              :aria-describedby="describedBy"
            />
            <p v-if="error" :id="errorId" class="error-text" role="alert">{{ error }}</p>
            <p v-else-if="duplicateOf" :id="warningId" class="warning-text" role="alert">
              Another client is already called "{{ duplicateOf }}". Rename anyway, or pick a
              different name.
            </p>
          </div>
          <div class="row rename-actions">
            <button type="button" class="btn" @click="cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">
              {{ duplicateOf ? 'Rename anyway' : 'Rename' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rename-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 90;
}

.rename-dialog {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--space-6);
  max-width: 400px;
  width: 100%;
  overscroll-behavior: contain;
}

/* Cancel on the left, away from the primary action (as in the confirm dialog). */
.rename-actions {
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: var(--space-4);
}
</style>
