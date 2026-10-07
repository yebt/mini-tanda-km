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
const ACTION_TIMEOUT_MS = 10_000

/** Why a toast is held open: the pointer is over it, or focus is inside it. */
export type ToastHold = 'hover' | 'focus'

/** Active toasts, oldest first. Rendered by the global <ToastHost />. */
export const toasts = shallowRef<Toast[]>([])

interface ToastClock {
  timer: ReturnType<typeof setTimeout> | undefined
  /** Time left before auto-dismiss, frozen while held. */
  remaining: number
  startedAt: number
  holds: Set<ToastHold>
}

const clocks = new Map<number, ToastClock>()
let nextId = 1

function start(id: number, clock: ToastClock): void {
  clock.startedAt = Date.now()
  clock.timer = setTimeout(() => dismissToast(id), clock.remaining)
}

export function dismissToast(id: number): void {
  clearTimeout(clocks.get(id)?.timer)
  clocks.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

/**
 * Pause a toast's auto-dismiss while the user points at it or works inside
 * it (WCAG 2.2.1), so an Undo never disappears under the cursor.
 */
export function holdToast(id: number, reason: ToastHold): void {
  const clock = clocks.get(id)
  if (!clock || clock.holds.has(reason)) return
  if (clock.holds.size === 0 && clock.timer !== undefined) {
    clearTimeout(clock.timer)
    clock.timer = undefined
    clock.remaining = Math.max(0, clock.remaining - (Date.now() - clock.startedAt))
  }
  clock.holds.add(reason)
}

/** Release a hold; the countdown resumes with the time that was left once nothing holds it. */
export function releaseToast(id: number, reason: ToastHold): void {
  const clock = clocks.get(id)
  if (!clock || !clock.holds.delete(reason)) return
  if (clock.holds.size === 0) start(id, clock)
}

/**
 * Confirm the outcome of an action (saved, recorded, deleted) in a polite
 * live region, optionally with one action such as Undo.
 */
export function notify(message: string, options: { action?: ToastAction } = {}): number {
  const id = nextId++
  // Keep the stack short: the newest outcomes matter most.
  const kept = toasts.value.slice(-2)
  for (const dropped of toasts.value.slice(0, -2)) dismissToast(dropped.id)
  toasts.value = [...kept, { id, message, action: options.action }]
  const clock: ToastClock = {
    timer: undefined,
    remaining: options.action ? ACTION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
    startedAt: 0,
    holds: new Set(),
  }
  clocks.set(id, clock)
  start(id, clock)
  return id
}

/** Run a toast's action once, then dismiss it. */
export function runToastAction(toast: Toast): void {
  dismissToast(toast.id)
  toast.action?.run()
}

/** Remove every toast (tests, data import). */
export function clearToasts(): void {
  for (const clock of clocks.values()) clearTimeout(clock.timer)
  clocks.clear()
  toasts.value = []
}
