import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { useProductsStore } from '@shared/stores/products'

import PricingSection from '../PricingSection.vue'

let productId: string

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  const store = useProductsStore()
  productId = store.saveProduct({
    name: 'Yogurt',
    description: null,
    photo: null,
    priceMode: 'per_sku',
    price: null,
  })
  const size = store.addVariation(productId, 'Size')
  store.addOption(size, '1L')
  store.addOption(size, '500ml')
  const flavor = store.addVariation(productId, 'Flavor')
  store.addOption(flavor, 'Fresa')
})

function current() {
  const store = useProductsStore()
  const product = store.products.find((candidate) => candidate.id === productId)!
  return { product, priceRows: store.priceRows.filter((row) => row.productId === productId) }
}

describe('PricingSection "Price depends on"', () => {
  it('is a fieldset of native checkboxes named by variation, with the option count', () => {
    const wrapper = mount(PricingSection, { props: current(), attachTo: document.body })
    const fieldset = wrapper.get('fieldset')
    expect(fieldset.get('legend').text()).toBe('Price depends on')

    const boxes = fieldset.findAll<HTMLInputElement>('input[type="checkbox"]')
    const described = boxes.map((box) => {
      const title = document.getElementById(box.attributes('aria-labelledby')!)?.textContent
      const desc = document.getElementById(box.attributes('aria-describedby')!)?.textContent
      return [title?.trim(), desc?.trim()]
    })
    expect(described).toEqual([
      ['Size', '2 options'],
      ['Flavor', '1 option'],
    ])
    expect(boxes.every((box) => !box.element.checked)).toBe(true)
    wrapper.unmount()
  })

  it('toggles which variations set the price', async () => {
    const wrapper = mount(PricingSection, { props: current(), attachTo: document.body })
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)
    await wrapper.setProps(current())

    expect(current().product.priceVariationIds).toHaveLength(1)
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')[0]!.element.checked).toBe(
      true,
    )
    expect(wrapper.find('table').exists()).toBe(true)
    wrapper.unmount()
  })
})
