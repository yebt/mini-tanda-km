import { beforeEach, describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { createPinia, setActivePinia } from 'pinia'

import { openWithInstance } from '../database'
import { createClient, getClient, renameClient } from '../repos/clients'
import { useClientsStore } from '@shared/stores/clients'

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
})

describe('renameClient (repo)', () => {
  it('updates the name and keeps the id', () => {
    const id = createClient('Lupe')
    renameClient(id, 'Lupita')
    expect(getClient(id)?.name).toBe('Lupita')
  })
})

describe('clients store rename', () => {
  it('trims the name and refreshes the list', () => {
    const store = useClientsStore()
    const id = store.addClient('Lupe')
    expect(store.renameClient(id, '  Lupita  ')).toEqual({ ok: true })
    expect(store.clients.find((client) => client.id === id)?.name).toBe('Lupita')
  })

  it('rejects an empty name', () => {
    const store = useClientsStore()
    const id = store.addClient('Lupe')
    expect(store.renameClient(id, '   ')).toEqual({ ok: false, error: 'Enter a name.' })
    expect(getClient(id)?.name).toBe('Lupe')
  })

  it('finds another client with the same name ignoring accents and case', () => {
    const store = useClientsStore()
    const jose = store.addClient('José Hernández')
    const dup = store.addClient('jose')
    expect(store.nameTakenBy('JOSE HERNANDEZ', dup)?.id).toBe(jose)
    expect(store.nameTakenBy('José Hernández', jose)).toBeNull()
    expect(store.nameTakenBy('Ana', dup)).toBeNull()
  })
})
