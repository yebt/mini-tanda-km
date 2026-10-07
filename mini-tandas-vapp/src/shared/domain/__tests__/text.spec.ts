import { describe, expect, it } from 'vitest'

import { findNearMatch, foldText, matchesQuery } from '../text'

describe('foldText', () => {
  it('drops accents, lowercases and collapses whitespace', () => {
    expect(foldText('  José   HERNÁNDEZ ')).toBe('jose hernandez')
    expect(foldText('Ñandú Güero')).toBe('nandu guero')
  })
})

describe('matchesQuery', () => {
  it('ignores accents and case on both sides', () => {
    expect(matchesQuery('José Hernández', 'jose')).toBe(true)
    expect(matchesQuery('Jose Hernandez', 'HERNÁN')).toBe(true)
    expect(matchesQuery('Ana López', 'jose')).toBe(false)
  })

  it('matches everything for a blank query', () => {
    expect(matchesQuery('Ana', '   ')).toBe(true)
  })
})

describe('findNearMatch', () => {
  const options = [
    { value: '1', label: 'José Hernández' },
    { value: '2', label: 'Ana López' },
  ]

  it('finds an option with the same folded name', () => {
    expect(findNearMatch('jose hernandez', options)?.value).toBe('1')
  })

  it('finds an option whose folded name starts with the query', () => {
    expect(findNearMatch('jose', options)?.value).toBe('1')
  })

  it('finds an option whose folded name is a word prefix of the query', () => {
    expect(findNearMatch('Ana Lopez Garcia', options)?.value).toBe('2')
  })

  it('returns null when nothing is close or the query is too short', () => {
    expect(findNearMatch('Lupita', options)).toBeNull()
    expect(findNearMatch('j', options)).toBeNull()
    expect(findNearMatch('Analopez', options)).toBeNull()
  })

  it('skips disabled options', () => {
    expect(findNearMatch('jose', [{ value: '1', label: 'José', disabled: true }])).toBeNull()
  })
})
