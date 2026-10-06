import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import type { Product } from '@shared/db/types'

import ProductList from '../ProductList.vue'

const product: Product = {
  id: 'p1',
  name: 'Cake',
  description: null,
  thumbnail: 'data:image/webp;base64,dGh1bWI=',
  priceMode: 'global',
  price: 10,
  priceVariationIds: [],
  variations: [],
}

function mountList() {
  return mount(ProductList, { props: { items: [{ product, skus: [], priceRows: [] }] } })
}

function stubViewport(mobile: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProductList', () => {
  it('renders only the table on desktop, with one lazily decoded thumbnail', () => {
    stubViewport(false)
    const wrapper = mountList()

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.find('.product-card').exists()).toBe(false)
    const images = wrapper.findAll('img')
    expect(images).toHaveLength(1)
    expect(images[0]!.attributes()).toMatchObject({
      loading: 'lazy',
      decoding: 'async',
      width: '40',
      height: '40',
    })
  })

  it('renders only the cards on mobile', () => {
    stubViewport(true)
    const wrapper = mountList()

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.findAll('.product-card')).toHaveLength(1)
    expect(wrapper.findAll('img')).toHaveLength(1)
  })
})
