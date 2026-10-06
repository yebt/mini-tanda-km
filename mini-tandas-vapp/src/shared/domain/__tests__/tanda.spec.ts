import { describe, expect, it } from 'vitest'

import type { TandaStatus, TandaType } from '@shared/db/types'
import {
  canDeliver,
  canEditInventory,
  canSell,
  canTransition,
  nextStatus,
  previousStatus,
} from '../tanda'

const STATUSES: TandaStatus[] = ['open', 'production', 'ready', 'closed']

function tanda(type: TandaType, status: TandaStatus) {
  return { type, status }
}

describe('canSell', () => {
  it('scheduled tandas take pre-orders only while open', () => {
    expect(STATUSES.filter((status) => canSell(tanda('scheduled', status)))).toEqual(['open'])
  })

  it('anticipated tandas sell only once production is done (ready)', () => {
    expect(STATUSES.filter((status) => canSell(tanda('anticipated', status)))).toEqual(['ready'])
  })
})

describe('canDeliver', () => {
  it.each<TandaType>(['scheduled', 'anticipated'])(
    '%s tandas mark delivery only from ready onwards',
    (type) => {
      expect(STATUSES.filter((status) => canDeliver(tanda(type, status)))).toEqual([
        'ready',
        'closed',
      ])
    },
  )
})

describe('canEditInventory', () => {
  it('anticipated tandas edit the batch inventory only while open', () => {
    expect(STATUSES.filter((status) => canEditInventory(tanda('anticipated', status)))).toEqual([
      'open',
    ])
  })

  it('scheduled tandas have no inventory', () => {
    expect(STATUSES.some((status) => canEditInventory(tanda('scheduled', status)))).toBe(false)
  })
})

describe('canTransition', () => {
  it('moves one step forward', () => {
    expect(canTransition('open', 'production')).toBe(true)
    expect(canTransition('production', 'ready')).toBe(true)
    expect(canTransition('ready', 'closed')).toBe(true)
  })

  it('moves one step back', () => {
    expect(canTransition('closed', 'ready')).toBe(true)
    expect(canTransition('ready', 'production')).toBe(true)
    expect(canTransition('production', 'open')).toBe(true)
  })

  it('refuses skipping steps and staying in place', () => {
    expect(canTransition('open', 'ready')).toBe(false)
    expect(canTransition('open', 'closed')).toBe(false)
    expect(canTransition('closed', 'open')).toBe(false)
    expect(canTransition('ready', 'ready')).toBe(false)
  })

  it('refuses unknown statuses', () => {
    expect(canTransition('open', 'archived' as TandaStatus)).toBe(false)
  })
})

describe('nextStatus / previousStatus', () => {
  it('walks the status flow one step at a time', () => {
    expect(nextStatus('open')).toBe('production')
    expect(nextStatus('closed')).toBeNull()
    expect(previousStatus('ready')).toBe('production')
    expect(previousStatus('open')).toBeNull()
  })
})
