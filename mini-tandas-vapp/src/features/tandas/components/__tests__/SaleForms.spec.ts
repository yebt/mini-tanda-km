import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { createClient } from '@shared/db/repos/clients'
import { createProduct, listSkusWithProducts } from '@shared/db/repos/products'
import { createSale, createTanda, getTanda } from '@shared/db/repos/tandas'

import SaleForm from '../SaleForm.vue'
import SaleList from '../SaleList.vue'

let tandaId: string

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  createProduct({ name: 'Cookies box', description: null, photo: null, priceMode: 'global', price: 120 })
  tandaId = createTanda({ name: 'Weekend cakes', date: '2026-10-10', type: 'scheduled' })
  document.body.innerHTML = ''
})

describe('SaleForm', () => {
  it('keeps "Add sale" enabled and says what is missing', async () => {
    const wrapper = mount(SaleForm, {
      props: { tandaId, type: 'scheduled' },
      attachTo: document.body,
    })
    const submit = wrapper.findAll('button').find((b) => b.text() === 'Add sale')!
    expect(submit.attributes('disabled')).toBeUndefined()

    await submit.trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toBe('Add at least one product.')
    expect(wrapper.emitted('submitted')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('SaleList', () => {
  it('explains why delivery cannot be marked before the tanda is ready', async () => {
    const clientId = createClient('Ana')
    const sku = listSkusWithProducts()[0]!
    createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 1 }] })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => null } }],
    })
    const wrapper = mount(SaleList, {
      props: { tanda: getTanda(tandaId)! },
      global: { plugins: [router] },
    })
    await flushPromises()

    const toggle = wrapper.get('input.delivered-input')
    expect(toggle.attributes('disabled')).toBeDefined()
    const hint = wrapper.get(`#${toggle.attributes('aria-describedby')}`)
    expect(hint.text()).toBe('Available once the tanda is ready')
  })
})
