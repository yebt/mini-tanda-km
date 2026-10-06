import { describe, expect, it } from 'vitest'

import { pageTitle, sectionOf } from '@shared/ui/usePageTitle'

import { isDetailPath, parentPath } from '../navigation'

describe('page titles', () => {
  it('names each section', () => {
    expect(pageTitle('/')).toBe('Dashboard · Mini Tanda')
    expect(pageTitle('/tandas')).toBe('Tandas · Mini Tanda')
    expect(pageTitle('/products')).toBe('Products · Mini Tanda')
    expect(pageTitle('/clients')).toBe('Clients · Mini Tanda')
    expect(pageTitle('/settings')).toBe('Settings · Mini Tanda')
  })

  it('puts the entity name first on detail views', () => {
    expect(pageTitle('/tandas/t1', 'Weekend cakes')).toBe('Weekend cakes · Tandas · Mini Tanda')
    expect(pageTitle('/clients/c1', '  ')).toBe('Clients · Mini Tanda')
  })

  it('falls back to the app name for unknown paths', () => {
    expect(sectionOf('/nope')).toBeNull()
    expect(pageTitle('/nope')).toBe('Mini Tanda')
  })
})

describe('back navigation', () => {
  it('only treats detail routes as deeper pages', () => {
    for (const top of ['/', '/tandas', '/products', '/clients', '/settings', '/tandas/']) {
      expect(isDetailPath(top)).toBe(false)
    }
    expect(isDetailPath('/tandas/t1')).toBe(true)
    expect(isDetailPath('/clients/c1')).toBe(true)
  })

  it('falls back to the parent list', () => {
    expect(parentPath('/tandas/t1')).toBe('/tandas')
    expect(parentPath('/clients/c1')).toBe('/clients')
  })
})
