import { getCurrentScope, onScopeDispose, shallowRef, type Ref } from 'vue'

/** Same breakpoint as the `.mobile-only` / `.desktop-only` rules in main.css. */
export const MOBILE_QUERY = '(max-width: 720px)'

/**
 * Reactive `matchMedia` result, kept in sync with the viewport and cleaned up
 * with the calling component (or effect scope). Where `matchMedia` does not
 * exist (Node, jsdom) it reports `false`, i.e. the desktop layout.
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = shallowRef(false)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return matches

  const list = window.matchMedia(query)
  matches.value = list.matches
  const onChange = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }
  list.addEventListener('change', onChange)
  if (getCurrentScope()) {
    onScopeDispose(() => list.removeEventListener('change', onChange))
  }
  return matches
}

/**
 * True on the mobile layout (≤720px). Lists use it to render either the
 * table or the cards, never both.
 */
export function useIsMobile(): Readonly<Ref<boolean>> {
  return useMediaQuery(MOBILE_QUERY)
}
