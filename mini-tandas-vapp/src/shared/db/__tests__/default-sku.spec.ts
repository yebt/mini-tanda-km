import { beforeEach, describe, expect, it } from 'vitest'
import initSqlJs, { type Database } from 'sql.js'

import { all, get, importAllData, openWithInstance, SCHEMA_VERSION } from '../database'
import { createClient } from '../repos/clients'
import {
  addOption,
  addVariation,
  createProduct,
  listSkusWithProducts,
  removeOption,
  removeVariation,
} from '../repos/products'
import {
  createSale,
  createTanda,
  listInventory,
  setInventoryQuantity,
  setTandaStatus,
} from '../repos/tandas'

let db: Database

beforeEach(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  openWithInstance(db)
})

function makeCookies(price: number | null = 120) {
  return createProduct({
    name: 'Cookies box',
    description: null,
    photo: null,
    priceMode: 'global',
    price,
  })
}

const skusOf = (productId: string) =>
  listSkusWithProducts().filter((sku) => sku.productId === productId)

describe('products without variations', () => {
  it('get exactly one SKU with an empty option set, priced by the global price', () => {
    const productId = makeCookies()
    const skus = skusOf(productId)
    expect(skus).toHaveLength(1)
    expect(skus[0]).toMatchObject({ optionIds: [], label: '', price: 120 })
  })

  it('keep the single SKU while variations have no options', () => {
    const productId = makeCookies()
    const before = skusOf(productId)[0]!.id
    const sizeId = addVariation(productId, 'SIZE')
    expect(skusOf(productId).map((sku) => sku.id)).toEqual([before])

    const personal = addOption(sizeId, 'Personal')
    expect(skusOf(productId).map((sku) => sku.optionIds)).toEqual([[personal]])

    removeOption(personal)
    expect(skusOf(productId).map((sku) => sku.optionIds)).toEqual([[]])

    removeVariation(sizeId)
    expect(skusOf(productId)).toHaveLength(1)
  })

  it('can be sold in a scheduled tanda', () => {
    const productId = makeCookies()
    const sku = skusOf(productId)[0]!
    const tandaId = createTanda({ name: 'T', date: '2026-10-10', type: 'scheduled' })
    const sale = createSale({
      tandaId,
      clientId: createClient('Ana'),
      items: [{ skuId: sku.id, quantity: 2 }],
    })
    expect(sale.ok).toBe(true)
  })

  it('can be stocked and sold in an anticipated tanda', () => {
    const productId = makeCookies()
    const sku = skusOf(productId)[0]!
    const tandaId = createTanda({ name: 'T', date: '2026-10-10', type: 'anticipated' })
    expect(setInventoryQuantity(tandaId, sku.id, 5)).toEqual({ ok: true })
    setTandaStatus(tandaId, 'production')
    setTandaStatus(tandaId, 'ready')
    const sale = createSale({
      tandaId,
      clientId: createClient('Ana'),
      items: [{ skuId: sku.id, quantity: 2 }],
    })
    expect(sale.ok).toBe(true)
    expect(listInventory(tandaId)[0]).toMatchObject({ produced: 5, sold: 2, available: 3 })
  })
})

describe('default SKU backfill', () => {
  /** A product row as an older app version left it: no SKU at all. */
  function insertBareProduct(id: string) {
    db.run(
      "INSERT INTO products (id, name, price_mode, price, price_variation_ids) VALUES (?, 'Flan', 'global', 9000, '[]')",
      [id],
    )
  }

  it(`migrates existing products without SKUs (schema v${SCHEMA_VERSION})`, () => {
    insertBareProduct('p1')
    // A variation without options still means "no variations" for SKUs.
    db.run("INSERT INTO variations (id, product_id, name) VALUES ('v1', 'p1', 'SIZE')")
    // A product whose variations have options keeps its own SKUs untouched.
    db.run(
      "INSERT INTO products (id, name, price_mode, price, price_variation_ids) VALUES ('p2', 'Cake', 'global', 100, '[]')",
    )
    db.run("INSERT INTO variations (id, product_id, name) VALUES ('v2', 'p2', 'SIZE')")
    db.run("INSERT INTO variation_options (id, variation_id, label) VALUES ('o1', 'v2', 'Big')")
    db.run("INSERT INTO skus (id, product_id, option_ids) VALUES ('s2', 'p2', '[\"o1\"]')")
    db.run('PRAGMA user_version = 2')

    openWithInstance(db)

    expect(get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(SCHEMA_VERSION)
    expect(skusOf('p1')).toMatchObject([{ optionIds: [], price: 90 }])
    expect(skusOf('p2').map((sku) => sku.id)).toEqual(['s2'])
  })

  it('backfills SKUs when importing an older backup', () => {
    importAllData({
      app: 'mini-tanda',
      schemaVersion: 1,
      data: {
        products: [
          { id: 'p1', name: 'Flan', price_mode: 'global', price: 90, price_variation_ids: '[]' },
        ],
        skus: [],
      },
    })
    expect(skusOf('p1')).toMatchObject([{ optionIds: [], price: 90 }])
    expect(all('SELECT * FROM skus')).toHaveLength(1)
  })
})
