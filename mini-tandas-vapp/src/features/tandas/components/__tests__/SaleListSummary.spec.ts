import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { addPayment, createClient } from '@shared/db/repos/clients'
import { createProduct, listSkusWithProducts } from '@shared/db/repos/products'
import { createSale, createTanda, getTanda, setDelivered, setTandaStatus } from '@shared/db/repos/tandas'

import SaleList from '../SaleList.vue'

let wrapper: VueWrapper | null = null
let router: Router
let tandaId: string

function sell(client: string, quantity: number) {
  const clientId = createClient(client)
  const result = createSale({
    tandaId,
    clientId,
    items: [{ skuId: listSkusWithProducts()[0]!.id, quantity }],
  })
  if (!result.ok) throw new Error(result.error)
  return { saleId: result.saleId, clientId }
}

async function mountList(query: Record<string, string> = {}) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/tandas/:id', component: { render: () => null } }],
  })
  await router.push({ path: `/tandas/${tandaId}`, query })
  wrapper = mount(SaleList, {
    props: { tanda: getTanda(tandaId)! },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const clientNames = () => wrapper!.findAll('.sale-client-name').map((el) => el.text())
const chip = (name: RegExp) => wrapper!.findAll('.filter-chip').find((b) => name.test(b.text()))!

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  createProduct({ name: 'Box', description: null, photo: null, priceMode: 'global', price: 100 })
  tandaId = createTanda({ name: 'Weekend', date: '2026-10-10', type: 'scheduled' })
  // Ana: $100, paid, delivered · Beto: $200, $50 paid · Caro: $100, unpaid, delivered.
  const ana = sell('Ana', 1)
  const beto = sell('Beto', 2)
  const caro = sell('Caro', 1)
  setTandaStatus(tandaId, 'production')
  setTandaStatus(tandaId, 'ready')
  setDelivered(ana.saleId, true)
  setDelivered(caro.saleId, true)
  addPayment({ clientId: ana.clientId, saleId: ana.saleId, amount: 100, note: null })
  addPayment({ clientId: beto.clientId, saleId: beto.saleId, amount: 50, note: null })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('SaleList summary and filters', () => {
  it('summarises count, total, paid, pending and deliveries', async () => {
    await mountList()
    const summary = wrapper!.get('.sales-summary').text()
    expect(summary).toContain('3 sales')
    expect(summary).toContain('MX$400.00')
    expect(summary).toContain('MX$150.00')
    expect(summary).toContain('MX$250.00')
    expect(summary).toContain('2/3')
  })

  it('offers All / Unpaid / Undelivered chips with counts and aria-pressed', async () => {
    await mountList()
    expect(chip(/^All/).text()).toBe('All 3')
    expect(chip(/^Unpaid/).text()).toBe('Unpaid 2')
    expect(chip(/^Undelivered/).text()).toBe('Undelivered 1')
    expect(chip(/^All/).attributes('aria-pressed')).toBe('true')
    expect(chip(/^Unpaid/).attributes('aria-pressed')).toBe('false')
  })

  it('filters the list and keeps the filter in ?filter=', async () => {
    await mountList()
    await chip(/^Unpaid/).trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.filter).toBe('unpaid')
    expect(chip(/^Unpaid/).attributes('aria-pressed')).toBe('true')
    expect(clientNames().sort()).toEqual(['Beto', 'Caro'])

    await chip(/^All/).trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.filter).toBeUndefined()
    expect(clientNames()).toHaveLength(3)
  })

  it('reads the filter from the URL', async () => {
    await mountList({ filter: 'undelivered' })
    expect(clientNames()).toEqual(['Beto'])
  })

  it('shows an empty-filter state with "Clear filter"', async () => {
    await mountList({ filter: 'undelivered' })
    const betoToggle = wrapper!.get('.delivered-input')
    await betoToggle.setValue(true)
    await flushPromises()
    expect(clientNames()).toEqual([])
    expect(wrapper!.text()).toContain('Every sale is delivered.')
    await wrapper!.findAll('button').find((b) => b.text() === 'Clear filter')!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.filter).toBeUndefined()
    expect(clientNames()).toHaveLength(3)
  })
})
