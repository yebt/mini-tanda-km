import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('../idb', () => ({
  idbGet: vi.fn<() => Promise<Uint8Array | null>>(() => Promise.resolve(null)),
  idbSet: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}))

import { idbSet } from '../idb'
import { flushPersistence, openWithInstance, registerPersistenceFlush, run } from '../database'

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

let unregister: () => void

beforeEach(async () => {
  vi.useFakeTimers()
  // Persistence is skipped where indexedDB does not exist (Node); pretend it does.
  vi.stubGlobal('indexedDB', {})
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  vi.mocked(idbSet).mockClear()
  unregister = registerPersistenceFlush()
})

afterEach(async () => {
  await flushPersistence()
  unregister()
  setVisibility('visible')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function pendingWrite() {
  run('INSERT INTO settings (key, value) VALUES (?, ?)', [`k${Math.random()}`, 'v'])
}

describe('persistence flush', () => {
  it('writes pending changes immediately when the page becomes hidden', () => {
    pendingWrite()
    expect(idbSet).not.toHaveBeenCalled()

    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(idbSet).toHaveBeenCalledTimes(1)
    // The debounced save was cancelled: nothing is written twice.
    vi.runAllTimers()
    expect(idbSet).toHaveBeenCalledTimes(1)
  })

  it('does not flush when the page becomes visible again', () => {
    pendingWrite()
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(idbSet).not.toHaveBeenCalled()
  })

  it('writes pending changes on pagehide and beforeunload', () => {
    pendingWrite()
    window.dispatchEvent(new Event('pagehide'))
    expect(idbSet).toHaveBeenCalledTimes(1)

    pendingWrite()
    window.dispatchEvent(new Event('beforeunload'))
    expect(idbSet).toHaveBeenCalledTimes(2)
  })

  it('skips the write when nothing is pending', () => {
    window.dispatchEvent(new Event('pagehide'))
    expect(idbSet).not.toHaveBeenCalled()
  })
})
