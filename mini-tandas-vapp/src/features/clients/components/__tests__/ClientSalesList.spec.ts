import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { createClient } from '@shared/db/repos/clients'
import { createProduct, listSkusWithProducts } from '@shared/db/repos/products'
import { createSale, createTanda } from '@shared/db/repos/tandas'

import ClientSalesList from '../ClientSalesList.vue'

let clientId: string

function sell(tandaId: string, quantity: number) {
  const sku = listSkusWithProducts()[0]!
  const result = createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity }] })
  if (!result.ok) throw new Error(result.error)
}

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  createProduct({
    name: 'Cookies box',
    description: null,
    photo: null,
    priceMode: 'global',
    price: 100,
  })
  clientId = createClient('Ana')
})

describe('ClientSalesList', () => {
  it('groups sales per tanda and offers Record payment per unpaid sale', async () => {
    const weekend = createTanda({ name: 'Weekend cakes', date: '2026-10-10', type: 'scheduled' })
    const party = createTanda({ name: 'Party', date: '2026-11-01', type: 'scheduled' })
    sell(weekend, 1)
    sell(weekend, 2)
    sell(party, 3)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/clients/:id', component: { render: () => null } }],
    })
    await router.push(`/clients/${clientId}`)
    const wrapper = mount(ClientSalesList, {
      props: { clientId },
      global: { plugins: [router] },
    })

    const groups = wrapper.findAll('.tanda-group')
    expect(groups.map((g) => g.get('h3').text())).toEqual(['Party', 'Weekend cakes'])
    expect(groups[1]!.findAll('.sale-item')).toHaveLength(2)
    expect(groups[1]!.text()).toContain('Open')

    const pay = groups[0]!.findAll('button').find((b) => b.text() === 'Record payment')!
    await pay.trigger('click')
    await flushPromises()
    expect(typeof router.currentRoute.value.query.pay).toBe('string')
  })
})
