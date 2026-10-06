/**
 * One mapping from tanda status / type to badge class and label, shared by
 * every screen so the same state always looks the same (HEU-04).
 * Amber (`badge-warning`) is reserved for states that need attention;
 * plain facts use the gray `badge-neutral`.
 */
import type { TandaStatus, TandaType } from '@shared/db/types'

const STATUS_BADGE: Record<TandaStatus, string> = {
  open: 'badge-info',
  production: 'badge-warning',
  ready: 'badge-success',
  closed: 'badge-neutral',
}

const TYPE_BADGE: Record<TandaType, string> = {
  scheduled: 'badge-info',
  anticipated: 'badge-neutral',
}

export function statusBadge(status: TandaStatus): string {
  return STATUS_BADGE[status]
}

export function typeBadge(type: TandaType): string {
  return TYPE_BADGE[type]
}

/** Enum value → display label ("production" → "Production"). */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function statusLabel(status: TandaStatus): string {
  return capitalize(status)
}

export function typeLabel(type: TandaType): string {
  return capitalize(type)
}
