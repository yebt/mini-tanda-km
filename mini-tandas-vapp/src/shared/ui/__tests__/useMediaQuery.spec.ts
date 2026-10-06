import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { MOBILE_QUERY, useIsMobile, useMediaQuery } from '../useMediaQuery'

type Listener = (event: { matches: boolean }) => void

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>()
  const list = {
    matches: initial,
    addEventListener: vi.fn<(type: string, listener: Listener) => void>((_, listener) => {
      listeners.add(listener)
    }),
    removeEventListener: vi.fn<(type: string, listener: Listener) => void>((_, listener) => {
      listeners.delete(listener)
    }),
  }
  const matchMedia = vi.fn<(query: string) => typeof list>(() => list)
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    matchMedia,
    listeners,
    change(matches: boolean) {
      for (const listener of listeners) listener({ matches })
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useMediaQuery', () => {
  it('reports the current match and follows viewport changes', () => {
    const media = stubMatchMedia(true)
    const scope = effectScope()
    const matches = scope.run(() => useIsMobile())!

    expect(media.matchMedia).toHaveBeenCalledWith(MOBILE_QUERY)
    expect(matches.value).toBe(true)
    media.change(false)
    expect(matches.value).toBe(false)
    scope.stop()
  })

  it('removes its listener when the owning scope is disposed', () => {
    const media = stubMatchMedia(false)
    const scope = effectScope()
    scope.run(() => useMediaQuery('(min-width: 1px)'))
    expect(media.listeners.size).toBe(1)

    scope.stop()

    expect(media.listeners.size).toBe(0)
  })

  it('falls back to the desktop layout where matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(useIsMobile().value).toBe(false)
  })
})
