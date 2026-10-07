import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { createClient, listClients } from '@shared/db/repos/clients'
import { loadSettings } from '@shared/db/settings'
import { useSettingsStore } from '@shared/stores/settings'
import { useConfirmHost } from '@shared/ui/useConfirm'

import Settings from '../settings/index.vue'

const { pending, accept } = useConfirmHost()

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  loadSettings()
  setActivePinia(createPinia())
})

/** Import a one-client backup over a database holding only "Mine". */
function importOverMine() {
  const store = useSettingsStore()
  createClient('Imported')
  const backup = JSON.parse(JSON.stringify(store.exportBackup()))
  store.importBackup({ ...backup, data: { ...backup.data, clients: [] } })
  createClient('Mine')
  store.replaceAllData(backup)
  return store
}

const restoreButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('button').find((b) => b.text() === 'Restore previous data')

describe('Settings: restore after "Replace all data"', () => {
  it('offers no restore before any import', () => {
    const wrapper = mount(Settings)
    expect(restoreButton(wrapper)).toBeUndefined()
  })

  it('restores the pre-import data after a specific confirmation', async () => {
    importOverMine()
    const wrapper = mount(Settings)
    expect(wrapper.text()).toContain('The data you had before the last import is kept')

    await restoreButton(wrapper)!.trigger('click')
    expect(pending.value?.message).toContain('Changes made since the import will be lost')
    accept()
    await flushPromises()

    expect(listClients().map((client) => client.name)).toEqual(['Mine'])
    expect(restoreButton(wrapper)).toBeUndefined()
    expect(wrapper.get('[role="status"]').text()).toBe('Previous data restored.')
  })

  it('can be dismissed, keeping the imported data', async () => {
    importOverMine()
    const wrapper = mount(Settings)
    await wrapper.findAll('button').find((b) => b.text() === 'Keep imported data')!.trigger('click')
    expect(restoreButton(wrapper)).toBeUndefined()
    expect(listClients().map((client) => client.name)).toEqual(['Imported'])
  })
})
