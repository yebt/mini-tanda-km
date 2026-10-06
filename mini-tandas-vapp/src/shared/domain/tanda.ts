/**
 * Pure tanda business rules (no database access). Repos enforce them on
 * every write and components read them to enable/disable actions, so the UI
 * and the data layer can never disagree.
 */
import { TANDA_STATUS_ORDER, type Tanda, type TandaStatus } from '@shared/db/types'

type TandaState = Pick<Tanda, 'type' | 'status'>

/**
 * Scheduled tandas take pre-orders while open; anticipated tandas sell
 * against the batch inventory once production is done (ready).
 */
export function canSell(tanda: TandaState): boolean {
  return tanda.type === 'scheduled' ? tanda.status === 'open' : tanda.status === 'ready'
}

/** Delivery can only be marked once the tanda passes from production to ready. */
export function canDeliver(tanda: TandaState): boolean {
  return tanda.status === 'ready' || tanda.status === 'closed'
}

/** Only anticipated tandas have a batch inventory, editable while open. */
export function canEditInventory(tanda: TandaState): boolean {
  return tanda.type === 'anticipated' && tanda.status === 'open'
}

/** Status moves one step at a time, forward or back (open → production → ready → closed). */
export function canTransition(from: TandaStatus, to: TandaStatus): boolean {
  const fromIndex = TANDA_STATUS_ORDER.indexOf(from)
  const toIndex = TANDA_STATUS_ORDER.indexOf(to)
  if (fromIndex < 0 || toIndex < 0) return false
  return Math.abs(toIndex - fromIndex) === 1
}

/** Next status in the flow, or null when the tanda is closed. */
export function nextStatus(status: TandaStatus): TandaStatus | null {
  const index = TANDA_STATUS_ORDER.indexOf(status)
  return index >= 0 ? (TANDA_STATUS_ORDER[index + 1] ?? null) : null
}

/** Previous status in the flow, or null when the tanda is open. */
export function previousStatus(status: TandaStatus): TandaStatus | null {
  const index = TANDA_STATUS_ORDER.indexOf(status)
  return index > 0 ? (TANDA_STATUS_ORDER[index - 1] ?? null) : null
}
