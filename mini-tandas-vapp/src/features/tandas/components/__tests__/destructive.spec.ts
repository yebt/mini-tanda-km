import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { addPayment, createClient } from '@shared/db/repos/clients'
import { createProduct, listSkusWithProducts } from '@shared/db/repos/products'
import { createSale, createTanda, getTanda } from '@shared/db/repos/tandas'
import { useClientsStore } from '@shared/stores/clients'
import { useProductsStore } from '@shared/stores/products'
import { useConfirmHost } from '@shared/ui/useConfirm'

import SaleList from '../SaleList.vue'
import StatusFlow from '../StatusFlow.vue'

const { pending, dismiss } = useConfirmHost()
let wrapper: VueWrapper | null = null
let tandaId: string
let clientId: string
let productId: string

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  productId = createProduct({
    name: 'Cookies box',
    description: null,
    photo: null,
    priceMode: 'global',
    price: 120,
  })
  tandaId = createTanda({ name: 'Weekend cakes', date: '2026-10-10', type: 'scheduled' })
  clientId = createClient('Ana')
})

afterEach(() => {
  dismiss()
  wrapper?.unmount()
  wrapper = null
})

describe('destructive actions state their consequences', () => {
  it('sale delete says payments stay as general credit, in a danger confirm', async () => {
    const sku = listSkusWithProducts()[0]!
    const sale = createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 4 }] })
    if (!sale.ok) throw new Error(sale.error)
    const saleId = sale.saleId
    addPayment({ clientId, saleId, amount: 400, note: null })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => null } }],
    })
    wrapper = mount(SaleList, {
      props: { tanda: getTanda(tandaId)! },
      global: { plugins: [router] },
    })
    await flushPromises()

    await wrapper.get('button.kebab').trigger('click')
    await flushPromises()
    await wrapper.get('.menu-item-danger').trigger('click')

    expect(pending.value?.message).toContain('MX$400.00')
    expect(pending.value?.message).toContain('general credit')
    expect(pending.value?.tone).toBe('danger')
  })

  it('advancing a scheduled tanda to production warns that pre-orders close', async () => {
    wrapper = mount(StatusFlow, { props: { tanda: getTanda(tandaId)! } })
    await wrapper.findAll('button').find((b) => b.text() === 'Advance to production')!.trigger('click')

    expect(pending.value?.message).toContain('Pre-orders will close')
    dismiss()
    await flushPromises()
    expect(getTanda(tandaId)!.status).toBe('open')
  })

  it('reports why a product or client cannot be deleted before asking', () => {
    const sku = listSkusWithProducts()[0]!
    createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 1 }] })
    expect(useProductsStore().removalBlocker(productId)).toMatch(/cannot be deleted/)
    expect(useClientsStore().removalBlocker(clientId)).toMatch(/cannot be deleted/)
    expect(useClientsStore().removalBlocker(createClient('Luna'))).toBeNull()
  })
})
