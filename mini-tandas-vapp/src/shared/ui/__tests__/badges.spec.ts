import { describe, expect, it } from 'vitest'

import { statusBadge, statusLabel, typeBadge, typeLabel } from '../badges'

describe('badges', () => {
  it('maps every tanda status to one class used on every screen', () => {
    expect(statusBadge('open')).toBe('badge-info')
    expect(statusBadge('production')).toBe('badge-warning')
    expect(statusBadge('ready')).toBe('badge-success')
    expect(statusBadge('closed')).toBe('badge-neutral')
  })

  it('keeps neutral facts out of the warning color', () => {
    expect(typeBadge('scheduled')).toBe('badge-info')
    expect(typeBadge('anticipated')).toBe('badge-neutral')
  })

  it('capitalizes enum labels in code, not with CSS', () => {
    expect(statusLabel('production')).toBe('Production')
    expect(typeLabel('anticipated')).toBe('Anticipated')
  })
})
