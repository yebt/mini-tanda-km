export const CURRENCY = 'MXN'

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: CURRENCY,
})

export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount)
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Accepts both a calendar date (`YYYY-MM-DD`) and a full ISO datetime. */
export function formatDate(isoDate: string): string {
  const parseable = isoDate.includes('T') ? isoDate : `${isoDate}T00:00:00`
  return dateFormatter.format(new Date(parseable))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
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
