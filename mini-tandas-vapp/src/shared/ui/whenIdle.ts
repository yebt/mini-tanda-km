/**
 * Run `task` when the browser is idle, or shortly after where idle callbacks
 * are unsupported (Safari). A no-op outside the browser.
 */
export function whenIdle(task: () => void, timeout = 2000): void {
  if (typeof window === 'undefined') return
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => task(), { timeout })
  } else {
    setTimeout(task, 200)
  }
}
