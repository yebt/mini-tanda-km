import { beforeEach, describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import {
  addOption,
  addVariation,
  createProduct,
  listSkusWithProducts,
  setPriceRow,
  setPricingVariations,
} from '@shared/db/repos/products'
import {
  createTanda,
  getTanda,
  setInventoryQuantity,
  setTandaStatus,
} from '@shared/db/repos/tandas'

import InventoryEditor from '../InventoryEditor.vue'

/** Flan priced by SIZE: Small has a price, Large does not. */
function seed() {
  const productId = createProduct({
    name: 'Flan',
    description: null,
    photo: null,
    priceMode: 'per_sku',
    price: null,
  })
  const sizeId = addVariation(productId, 'SIZE')
  const small = addOption(sizeId, 'Small')
  addOption(sizeId, 'Large')
  setPricingVariations(productId, [sizeId])
  setPriceRow(productId, [small], 50)
  const skus = listSkusWithProducts()
  const priced = skus.find((sku) => sku.label === 'Small')!
  const unpriced = skus.find((sku) => sku.label === 'Large')!
  const tandaId = createTanda({ name: 'T', date: '2026-10-10', type: 'anticipated' })
  return { priced, unpriced, tandaId }
}

function mountEditor(tandaId: string, sellable: boolean) {
  return mount(InventoryEditor, {
    props: { tanda: getTanda(tandaId)!, sellable },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

function rowOf(wrapper: ReturnType<typeof mountEditor>, label: string) {
  return wrapper.findAll('table tr').find((row) => row.findAll('td')[0]?.text() === label)!
}

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
})

describe('InventoryEditor', () => {
  it('offers no stock input for an unpriced SKU and explains why', () => {
    const { tandaId } = seed()
    const wrapper = mountEditor(tandaId, false)

    expect(rowOf(wrapper, 'Small').find('input').attributes('aria-label')).toBe(
      'Produced — Flan (Small)',
    )
    const large = rowOf(wrapper, 'Large')
    expect(large.find('input').exists()).toBe(false)
    expect(large.text()).toContain('No price set')
    expect(large.findComponent(RouterLinkStub).props('to')).toBe('/products')
  })

  it('shows Sell only for priced SKUs with stock', () => {
    const { priced, tandaId } = seed()
    expect(setInventoryQuantity(tandaId, priced.id, 3)).toEqual({ ok: true })
    setTandaStatus(tandaId, 'production')
    setTandaStatus(tandaId, 'ready')
    const wrapper = mountEditor(tandaId, true)

    expect(rowOf(wrapper, 'Small').find('button').text()).toBe('Sell')
    // Never produced: not part of this batch, so the locked view leaves it out.
    expect(rowOf(wrapper, 'Large')).toBeUndefined()
  })

  it('locked view: red only for sold-out SKUs, no unproduced SKUs or empty groups', () => {
    const { priced, tandaId } = seed()
    createProduct({ name: 'Brownie', description: null, photo: null, priceMode: 'global', price: 30 })
    expect(setInventoryQuantity(tandaId, priced.id, 2)).toEqual({ ok: true })
    setTandaStatus(tandaId, 'production')
    const wrapper = mountEditor(tandaId, false)

    expect(wrapper.findAll('.group-row').map((row) => row.text())).toEqual(['Flan'])
    expect(wrapper.text()).not.toContain('Brownie')
    expect(wrapper.findAll('.stock-out')).toHaveLength(0)
  })
})
