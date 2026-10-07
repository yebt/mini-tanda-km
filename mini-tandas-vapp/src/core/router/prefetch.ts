import type { RouteRecordNormalized, Router } from 'vue-router'

type Loader = () => Promise<unknown>

/** Loaders already fetched (or in flight); a failed one is removed so it can retry. */
const prefetched = new WeakSet<Loader>()

/**
 * Lazy route components are plain functions returning `import()`; real
 * components are objects (SFCs) or carry component markers.
 */
function isLazyLoader(component: unknown): component is Loader {
  return (
    typeof component === 'function' &&
    !('displayName' in component) &&
    !('props' in component) &&
    !('__vccOpts' in component)
  )
}

function loadersOf(records: readonly RouteRecordNormalized[]): Loader[] {
  return records.flatMap((record) =>
    Object.values(record.components ?? {}).filter(isLazyLoader),
  )
}

async function load(loaders: Loader[]): Promise<void> {
  await Promise.all(
    loaders
      .filter((loader) => !prefetched.has(loader))
      .map(async (loader) => {
        prefetched.add(loader)
        try {
          await loader()
        } catch {
          // Offline or a stale deploy: navigation will retry and report it.
          prefetched.delete(loader)
        }
      }),
  )
}

/** Fetch the code of the route a link points to (e.g. on hover/focus). */
export function prefetchRoute(router: Router, to: string): Promise<void> {
  return load(loadersOf(router.resolve(to).matched))
}

/** Fetch every lazy route chunk (run when the browser is idle). */
export function prefetchAllRoutes(router: Router): Promise<void> {
  return load(loadersOf(router.getRoutes()))
}
