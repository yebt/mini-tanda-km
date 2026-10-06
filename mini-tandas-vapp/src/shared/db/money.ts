/**
 * Money is stored as integer cents in the database and exposed as currency
 * units (e.g. 89.9) by the repos. These helpers are the only place where the
 * conversion happens.
 */

/** Currency units → integer cents, rounding half away from zero. */
export function toCents(amount: number): number {
  // `toPrecision` drops binary noise first (1.005 * 100 = 100.49999999999999).
  const scaled = Number((amount * 100).toPrecision(15))
  return Math.sign(scaled) * Math.round(Math.abs(scaled))
}

/** Integer cents → currency units. */
export function fromCents(cents: number): number {
  return cents / 100
}

export function toCentsOrNull(amount: number | null): number | null {
  return amount === null ? null : toCents(amount)
}

export function fromCentsOrNull(cents: number | null): number | null {
  return cents === null ? null : fromCents(cents)
}

/**
 * Parse a money amount typed by a person (Postel's law): blank → null,
 * otherwise a non-negative number or NaN. Accepts a currency symbol or code,
 * spaces, thousands separators and either "." or "," as the decimal mark
 * ("1,234.50", "1.234,50", "12,5", "$ 90").
 */
export function parseMoneyInput(text: string): number | null {
  let value = text.trim().replace(/^[A-Za-z]{1,3}(?=\$)/, '').replace(/[\s$€£]/g, '')
  if (value === '') return null
  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: whichever comes last is the decimal mark.
    value =
      lastComma > lastDot
        ? value.replace(/\./g, '').replace(',', '.')
        : value.replace(/,/g, '')
  } else if (lastComma >= 0) {
    // "12,5" / "12,50" is a decimal comma; "1,234" groups thousands.
    value = /^\d+,\d{1,2}$/.test(value) ? value.replace(',', '.') : value.replace(/,/g, '')
  }
  return /^(\d+(\.\d*)?|\.\d+)$/.test(value) ? Number(value) : Number.NaN
}
