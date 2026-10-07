import { onBeforeUnmount, onMounted } from 'vue'

let sequence = 0

/**
 * Makes an overlay (sheet, dialog) history-aware: while it is mounted it owns
 * one extra history entry on the same URL, so the browser/Android Back button
 * closes the overlay instead of leaving the page.
 *
 * - Back pops that entry and calls `onBack`, which runs the same close request
 *   as × or Escape (and may ask before discarding). Returning `false` keeps the
 *   overlay open and restores the entry, so the next Back asks again.
 * - Closing any other way removes the entry with `history.back()`, unless a
 *   navigation already replaced it (the entry is no longer the current one).
 *
 * The entry copies the router's state, so vue-router sees a same-location
 * popstate and does not navigate.
 */
export function useBackToClose(onBack: () => boolean | Promise<boolean>): void {
  const key = `overlay-${++sequence}`
  let entryIsCurrent = false
  let mounted = false

  const isOwnEntry = () => (window.history.state as { overlay?: string } | null)?.overlay === key

  function pushEntry(): void {
    window.history.pushState({ ...window.history.state, overlay: key }, '')
    entryIsCurrent = true
  }

  async function onPopState(): Promise<void> {
    if (!entryIsCurrent || isOwnEntry()) return
    entryIsCurrent = false
    const closed = await onBack()
    if (!closed && mounted) pushEntry()
  }

  onMounted(() => {
    mounted = true
    pushEntry()
    window.addEventListener('popstate', onPopState)
  })

  onBeforeUnmount(() => {
    mounted = false
    window.removeEventListener('popstate', onPopState)
    if (entryIsCurrent && isOwnEntry()) window.history.back()
    entryIsCurrent = false
  })
}
