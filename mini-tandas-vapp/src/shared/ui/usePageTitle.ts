import { toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import { useRoute } from 'vue-router'

export const APP_NAME = 'Mini Tanda'

/** Top-level sections, keyed by the first path segment. */
const SECTIONS: Record<string, string> = {
  '': 'Dashboard',
  tandas: 'Tandas',
  products: 'Products',
  clients: 'Clients',
  settings: 'Settings',
}

/** Section name for a path ("/tandas/42" → "Tandas"), or null when unknown. */
export function sectionOf(path: string): string | null {
  const first = path.split('/').filter(Boolean)[0] ?? ''
  return SECTIONS[first] ?? null
}

/**
 * Document title for a view, most specific first:
 * "Weekend cakes · Tandas · Mini Tanda", "Products · Mini Tanda".
 */
export function pageTitle(path: string, entity?: string | null): string {
  return [entity?.trim() || null, sectionOf(path), APP_NAME]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

/**
 * Keep `document.title` naming the entity a detail view shows. The router
 * sets the section title on every navigation; this refines it while the
 * calling view's route stays active.
 */
export function usePageTitle(entity: MaybeRefOrGetter<string | null | undefined>): void {
  const route = useRoute()
  const ownName = route.name
  watchEffect(() => {
    if (route.name !== ownName) return
    document.title = pageTitle(route.path, toValue(entity))
  })
}
