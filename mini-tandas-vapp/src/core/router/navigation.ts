/**
 * Detail views (e.g. /tandas/:id) sit one level below a top-level section;
 * only they get the mobile back button (SPECS: "deeper pages get a back button").
 */
export function isDetailPath(path: string): boolean {
  return path.split('/').filter(Boolean).length > 1
}

/** The list a detail view belongs to: "/tandas/42" → "/tandas". */
export function parentPath(path: string): string {
  const segments = path.split('/').filter(Boolean)
  segments.pop()
  return `/${segments.join('/')}`
}
