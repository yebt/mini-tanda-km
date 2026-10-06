import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { openWithInstance, SCHEMA_VERSION } from '@shared/db/database'
import { createClient, listClients } from '@shared/db/repos/clients'
import { loadSettings } from '@shared/db/settings'
import { useSettingsStore } from '../settings'

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  loadSettings()
  setActivePinia(createPinia())
})

describe('settings store backups', () => {
  it('exports the full data set with app marker and schema version', () => {
    createClient('Ana')
    const backup = useSettingsStore().exportBackup()
    expect(backup).toMatchObject({ app: 'mini-tanda', schemaVersion: SCHEMA_VERSION })
    expect(backup.data.clients).toHaveLength(1)
  })

  it('imports a backup, replacing data and reloading the currency', () => {
    const store = useSettingsStore()
    store.changeCurrency('USD')
    createClient('Ana')
    const backup = JSON.parse(JSON.stringify(store.exportBackup()))

    store.changeCurrency('EUR')
    createClient('Luis')

    expect(store.importBackup(backup)).toBe(2)
    expect(listClients().map((client) => client.name)).toEqual(['Ana'])
    expect(store.currency).toBe('USD')
  })
})
