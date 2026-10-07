/**
 * Text matching for search fields. People type names without accents and in
 * any case ("jose" for "José"), so every comparison runs on a folded form:
 * accents stripped, lowercase, whitespace collapsed.
 */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when `label` contains `query`, ignoring accents and case. A blank query matches. */
export function matchesQuery(label: string, query: string): boolean {
  const q = foldText(query)
  return q === '' || foldText(label).includes(q)
}

/** Shortest query that can suggest an existing name (one letter is too noisy). */
const MIN_NEAR_LENGTH = 2

/**
 * An existing option that the query most likely means, used to warn before
 * creating a near-duplicate: same folded name, a folded name that starts with
 * the query, or a folded name that is a whole-word prefix of the query
 * ("Ana Lopez Garcia" → "Ana López"). Disabled options are never suggested.
 */
export function findNearMatch<T extends { label: string; disabled?: boolean }>(
  query: string,
  options: readonly T[],
): T | null {
  const q = foldText(query)
  if (q.length < MIN_NEAR_LENGTH) return null
  return (
    options.find((option) => {
      if (option.disabled) return false
      const label = foldText(option.label)
      return label === q || label.startsWith(q) || q.startsWith(`${label} `)
    }) ?? null
  )
}
