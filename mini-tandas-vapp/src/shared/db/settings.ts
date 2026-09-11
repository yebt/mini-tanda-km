import { shallowRef } from 'vue'

import { getSetting, setSetting } from './repos/settings'

export const SUPPORTED_CURRENCIES = [
  'MXN',
  'USD',
  'EUR',
  'COP',
  'ARS',
  'CLP',
  'PEN',
  'GTQ',
  'BRL',
] as const

/** Reactive app currency, read by formatMoney and editable in Settings. */
export const currency = shallowRef<string>('MXN')

/** Load persisted settings into reactive state. Call once after DB init. */
export function loadSettings(): void {
  currency.value = getSetting('currency') ?? 'MXN'
}

export function setCurrency(code: string): void {
  currency.value = code
  setSetting('currency', code)
}
