import { shallowRef } from 'vue'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  action?: ToastAction
}

const DEFAULT_TIMEOUT_MS = 5000
/** Toasts with an action (Undo) stay longer so there is time to use it. */
const ACTION_TIMEOUT_MS = 8000

/** Active toasts, oldest first. Rendered by the global <ToastHost />. */
export const toasts = shallowRef<Toast[]>([])

const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 1

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

/**
 * Confirm the outcome of an action (saved, recorded, deleted) in a polite
 * live region, optionally with one action such as Undo.
 */
export function notify(message: string, options: { action?: ToastAction } = {}): number {
  const id = nextId++
  // Keep the stack short: the newest outcomes matter most.
  toasts.value = [...toasts.value.slice(-2), { id, message, action: options.action }]
  timers.set(
    id,
    setTimeout(() => dismissToast(id), options.action ? ACTION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
  )
  return id
}

/** Run a toast's action once, then dismiss it. */
export function runToastAction(toast: Toast): void {
  dismissToast(toast.id)
  toast.action?.run()
}

/** Remove every toast (tests, data import). */
export function clearToasts(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  toasts.value = []
}
