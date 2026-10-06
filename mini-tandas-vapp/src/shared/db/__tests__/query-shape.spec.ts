import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

import { openWithInstance, requireDb } from '../database'
import {
  addOption,
  addVariation,
  createProduct,
  getProduct,
  listProducts,
  listSkusWithProducts,
  setPriceRow,
  setPricingVariations,
} from '../repos/products'

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
})

function seedCatalog(count: number) {
  for (let i = 0; i < count; i++) {
    const id = createProduct({
      name: `Product ${String(count - i).padStart(2, '0')}`,
      description: null,
      priceMode: i % 2 === 0 ? 'global' : 'per_sku',
      price: i % 2 === 0 ? 10 + i : null,
    })
    const size = addVariation(id, 'Size')
    const small = addOption(size, 'S')
    addOption(size, 'L')
    const color = addVariation(id, 'Color')
    addOption(color, 'Red')
    addOption(color, 'Blue')
    if (i % 2 === 1) {
      setPricingVariations(id, [size])
      setPriceRow(id, [small], 5 + i)
    }
  }
}

/** Count SQL statements prepared while `fn` runs. */
function countQueries(fn: () => void): number {
  const spy = vi.spyOn(requireDb(), 'prepare')
  try {
    fn()
    return spy.mock.calls.length
  } finally {
    spy.mockRestore()
  }
}

describe('catalog query shape', () => {
  it('loads products with their variations in a constant number of queries', () => {
    seedCatalog(3)
    const few = countQueries(() => listProducts())
    seedCatalog(6)
    const many = countQueries(() => listProducts())

    expect(many).toBe(few)
    expect(many).toBeLessThanOrEqual(3)
  })

  it('lists SKUs without re-running the per-product queries', () => {
    seedCatalog(3)
    const few = countQueries(() => listSkusWithProducts())
    seedCatalog(6)
    const many = countQueries(() => listSkusWithProducts())

    expect(many).toBe(few)
    // Reusing already-loaded products only queries SKUs and prices.
    const products = listProducts()
    expect(countQueries(() => listSkusWithProducts(products))).toBe(2)
  })

  it('keeps variations and options in their position order, per product', () => {
    const id = createProduct({ name: 'Cake', description: null, priceMode: 'global', price: 1 })
    const flavor = addVariation(id, 'Flavor')
    const choc = addOption(flavor, 'Chocolate')
    const coffee = addOption(flavor, 'Coffee')
    const size = addVariation(id, 'Size')
    const family = addOption(size, 'Family')
    const other = createProduct({ name: 'Bread', description: null, priceMode: 'global', price: 1 })
    const kind = addVariation(other, 'Kind')
    const white = addOption(kind, 'White')

    const expected = [
      {
        id: flavor,
        name: 'Flavor',
        options: [
          { id: choc, label: 'Chocolate' },
          { id: coffee, label: 'Coffee' },
        ],
      },
      { id: size, name: 'Size', options: [{ id: family, label: 'Family' }] },
    ]
    expect(getProduct(id)!.variations).toEqual(expected)
    expect(listProducts().map((p) => [p.name, p.variations])).toEqual([
      ['Bread', [{ id: kind, name: 'Kind', options: [{ id: white, label: 'White' }] }]],
      ['Cake', expected],
    ])
  })

  it('returns the same SKUs whether products are loaded or reused', () => {
    seedCatalog(4)
    const fresh = listSkusWithProducts()

    expect(listSkusWithProducts(listProducts())).toEqual(fresh)
    expect(fresh).toHaveLength(16)
    expect(fresh.map((sku) => `${sku.productName} ${sku.label} ${sku.price}`)).toEqual([
      'Product 01 L · Blue null',
      'Product 01 L · Red null',
      'Product 01 S · Blue 8',
      'Product 01 S · Red 8',
      'Product 02 L · Blue 12',
      'Product 02 L · Red 12',
      'Product 02 S · Blue 12',
      'Product 02 S · Red 12',
      'Product 03 L · Blue null',
      'Product 03 L · Red null',
      'Product 03 S · Blue 6',
      'Product 03 S · Red 6',
      'Product 04 L · Blue 10',
      'Product 04 L · Red 10',
      'Product 04 S · Blue 10',
      'Product 04 S · Red 10',
    ])
  })
})
