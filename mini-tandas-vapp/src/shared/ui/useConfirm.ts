import { shallowRef } from 'vue'

export type ConfirmTone = 'default' | 'danger'

export interface ConfirmOptions {
  /** `danger` renders the confirm button as destructive (red). */
  tone?: ConfirmTone
}

interface ConfirmRequest {
  message: string
  confirmLabel: string
  tone: ConfirmTone
  resolve: (accepted: boolean) => void
}

/**
 * Singleton confirm-dialog state. `confirmDialog()` returns a promise that
 * resolves when the user picks an action in the global <ConfirmDialogHost />.
 */
const pending = shallowRef<ConfirmRequest | null>(null)

export function confirmDialog(
  message: string,
  confirmLabel = 'Confirm',
  options: ConfirmOptions = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    pending.value = { message, confirmLabel, tone: options.tone ?? 'default', resolve }
  })
}

export function useConfirmHost() {
  function accept(): void {
    pending.value?.resolve(true)
    pending.value = null
  }
  function dismiss(): void {
    pending.value?.resolve(false)
    pending.value = null
  }
  return { pending, accept, dismiss }
}
