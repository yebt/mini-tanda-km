import { currency } from './settings'

export { SUPPORTED_CURRENCIES } from './settings'

const FALLBACK_LOCALE = 'en-US'

/**
 * The person's locale (WIG-21), so e.g. MXN reads "$1,234.50" for es-MX
 * instead of "MX$". Falls back to en-US when missing or invalid.
 */
export function appLocale(): string {
  const candidate =
    typeof navigator === 'undefined' ? undefined : (navigator.languages?.[0] ?? navigator.language)
  if (!candidate) return FALLBACK_LOCALE
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? FALLBACK_LOCALE
  } catch {
    return FALLBACK_LOCALE
  }
}

export function formatMoney(amount: number): string {
  const locale = appLocale()
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.value,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'MXN' }).format(amount)
  }
}

/** Accepts both a calendar date (`YYYY-MM-DD`) and a full ISO datetime. */
export function formatDate(isoDate: string): string {
  const parseable = isoDate.includes('T') ? isoDate : `${isoDate}T00:00:00`
  return new Intl.DateTimeFormat(appLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(parseable))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(appLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** Local date as YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
