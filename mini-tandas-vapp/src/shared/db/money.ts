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
