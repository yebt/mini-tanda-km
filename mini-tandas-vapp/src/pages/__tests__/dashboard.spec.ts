import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { useTandasStore } from '@shared/stores/tandas'

import Dashboard from '../index.vue'

function mountDashboard() {
  return mount(Dashboard, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
})

describe('Dashboard', () => {
  it('has one page heading, puts Next up first and uses labels, not numbers, as headings', () => {
    const wrapper = mountDashboard()
    expect(wrapper.findAll('h1').map((h) => h.text())).toEqual(['Dashboard'])
    const headings = wrapper.findAll('h2').map((h) => h.text())
    expect(headings).toEqual(['Next up', 'Active tandas', 'Owed by clients', 'Products'])
  })

  it('opens the creation form from "New tanda"', () => {
    const link = mountDashboard()
      .findAllComponents(RouterLinkStub)
      .find((l) => l.text() === 'New tanda')!
    expect(link.props('to')).toEqual({ path: '/tandas', query: { new: '1' } })
  })

  it('keeps "Next up" in sync when tandas change while mounted', async () => {
    const wrapper = mountDashboard()
    expect(wrapper.text()).toContain('No active tandas')

    useTandasStore().addTanda({ name: 'Weekend cakes', date: '2026-10-10', type: 'scheduled' })
    await flushPromises()

    expect(wrapper.find('.upcoming-list').text()).toContain('Weekend cakes')
  })
})
