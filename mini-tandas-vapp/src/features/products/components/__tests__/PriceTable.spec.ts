import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import {
  addOption,
  addVariation,
  createProduct,
  listPriceRows,
  listProducts,
  setPricingVariations,
} from '@shared/db/repos/products'

import PriceTable from '../PriceTable.vue'

function seed() {
  const productId = createProduct({
    name: 'Cake',
    description: null,
    photo: null,
    priceMode: 'per_sku',
    price: null,
  })
  const sizeId = addVariation(productId, 'SIZE')
  addOption(sizeId, 'Personal')
  setPricingVariations(productId, [sizeId])
  return productId
}

function mountTable(productId: string) {
  const product = listProducts().find((p) => p.id === productId)!
  return mount(PriceTable, { props: { product, priceRows: listPriceRows(productId) } })
}

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
})

describe('PriceTable', () => {
  it('stores 0 as a valid price, like the General tab', async () => {
    const productId = seed()
    const wrapper = mountTable(productId)
    const input = wrapper.get('input')
    expect(input.attributes('inputmode')).toBe('decimal')
    await input.setValue('0')
    await input.trigger('change')
    expect(listPriceRows(productId).map((row) => row.price)).toEqual([0])
  })

  it('shows an inline error instead of silently discarding an invalid price', async () => {
    const productId = seed()
    const wrapper = mountTable(productId)
    const input = wrapper.get('input')
    await input.setValue('-5')
    await input.trigger('change')

    expect(listPriceRows(productId)).toHaveLength(0)
    const error = wrapper.get('[role="alert"]')
    expect(error.text()).toContain('0 or more')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain(error.attributes('id'))
    expect((input.element as HTMLInputElement).value).toBe('-5')
  })
})
