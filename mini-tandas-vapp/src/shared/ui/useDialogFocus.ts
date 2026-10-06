import { onBeforeUnmount, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Open dialogs, oldest first: only the topmost one handles Escape and Tab. */
const stack: symbol[] = []

/** Keyboard-focusable descendants of `container`, in DOM order. */
export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.closest('[inert]') && !element.hidden,
  )
}

/**
 * Modal dialog focus management (WAI-ARIA dialog pattern): while `active`,
 * focus moves into the dialog, Tab/Shift+Tab cycle inside it, Escape calls
 * `onEscape`, and on close focus returns to the element that opened it.
 * Stacked dialogs are supported: only the topmost one reacts to keys.
 * An Escape already handled by an inner widget (`defaultPrevented`, e.g. a
 * combobox closing its list) is ignored.
 */
export function useDialogFocus(options: {
  container: Ref<HTMLElement | null>
  onEscape: () => void
  /** Defaults to true: active for the component's lifetime. */
  active?: MaybeRefOrGetter<boolean>
  /** Element to focus on open when focus is not already inside the dialog. */
  initialFocus?: () => HTMLElement | null | undefined
}): void {
  const id = Symbol('dialog')
  let opener: HTMLElement | null = null
  let isActive = false

  function onKeydown(event: KeyboardEvent): void {
    if (stack[stack.length - 1] !== id) return
    const container = options.container.value
    if (!container) return
    if (event.key === 'Escape') {
      if (event.defaultPrevented) return
      event.preventDefault()
      options.onEscape()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = focusableIn(container)
    if (focusable.length === 0) {
      event.preventDefault()
      container.focus()
      return
    }
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    const current = document.activeElement
    const inside = current instanceof Node && container.contains(current)
    if (event.shiftKey && (current === first || !inside)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (current === last || !inside)) {
      event.preventDefault()
      first.focus()
    }
  }

  function activate(container: HTMLElement): void {
    if (isActive) return
    isActive = true
    if (opener && container.contains(opener)) opener = null
    stack.push(id)
    document.addEventListener('keydown', onKeydown)
    if (!container.contains(document.activeElement)) {
      const target = options.initialFocus?.() ?? focusableIn(container)[0] ?? container
      target.focus()
    }
  }

  function deactivate(): void {
    if (!isActive) return
    isActive = false
    document.removeEventListener('keydown', onKeydown)
    const index = stack.indexOf(id)
    if (index >= 0) stack.splice(index, 1)
    if (opener?.isConnected) opener.focus()
    opener = null
  }

  // Remember the opener synchronously, before children (e.g. a form that
  // autofocuses its first field) can move focus into the dialog.
  watch(
    () => toValue(options.active ?? true),
    (active) => {
      if (!active || isActive) return
      const current = document.activeElement
      opener = current instanceof HTMLElement && current !== document.body ? current : null
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    () => [toValue(options.active ?? true), options.container.value] as const,
    ([active, container]) => {
      if (active && container) activate(container)
      else deactivate()
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(deactivate)
}
