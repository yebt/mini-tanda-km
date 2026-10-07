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

  it('uses one quantity stepper for the pending line and for each item row', async () => {
    const sku = listSkusWithProducts()[0]!
    const wrapper = mount(SaleForm, {
      props: { tandaId, type: 'scheduled', initialSkuId: sku.id },
      attachTo: document.body,
    })
    const button = (name: string) => wrapper.get(`button[aria-label="${name}"]`)

    await button('Increase amount').trigger('click')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Quantity"]').element.value).toBe('2')
    await wrapper.findAll('button').find((b) => b.text() === 'Add line')!.trigger('click')

    const units = wrapper.get<HTMLInputElement>('input[aria-label="Units of Cookies box"]')
    expect(units.element.value).toBe('2')
    expect(wrapper.get('.line-total').text()).toContain('240.00')

    await button('One more Cookies box').trigger('click')
    expect(units.element.value).toBe('3')
    expect(wrapper.get('.line-total').text()).toContain('360.00')

    await units.setValue('1')
    expect(button('One less Cookies box').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.line-total').text()).toContain('120.00')
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
    // A product without variations is labelled by its name alone, not "Cookies box ()".
    expect(wrapper.get('.sale-item-label').text()).toBe('1 × Cookies box')
  })
})
