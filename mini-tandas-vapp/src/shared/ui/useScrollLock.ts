import { onMounted, onUnmounted } from 'vue'

let locks = 0
let savedOverflow = ''

/** Freezes background scrolling while at least one overlay is open. */
export function lockScroll(): void {
  if (locks === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locks++
}

export function unlockScroll(): void {
  if (locks === 0) return
  locks--
  if (locks === 0) document.body.style.overflow = savedOverflow
}

/** Locks body scroll for the lifetime of the calling component. */
export function useScrollLock(): void {
  onMounted(lockScroll)
  onUnmounted(unlockScroll)
}
