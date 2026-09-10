import { beforeEach, describe, expect, it } from 'vitest'
import initSqlJs, { type Database } from 'sql.js'

import { openWithInstance } from '../database'
import { createClient, addPayment, listClients } from '../repos/clients'
import {
  addOption,
  addVariation,
  createProduct,
  deleteProduct,
  listProducts,
  listSkusWithProducts,
  productInUse,
  removeOption,
  setSkuPrice,
} from '../repos/products'
import {
  createSale,
  createTanda,
  deleteSale,
  getTanda,
  listInventory,
  listSales,
  setDelivered,
  setInventoryQuantity,
  setTandaStatus,
} from '../repos/tandas'
import { priceForSku } from '../types'

let db: Database

beforeEach(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  openWithInstance(db)
})

function makeCake(priceMode: 'global' | 'per_sku' = 'per_sku') {
  const productId = createProduct({
    name: 'Cake',
    description: null,
    photo: null,
    priceMode,
    price: priceMode === 'global' ? 100 : null,
  })
  const flavorId = addVariation(productId, 'FLAVOR')
  const sizeId = addVariation(productId, 'SIZE')
  const coffee = addOption(flavorId, 'Coffee')
  const redVelvet = addOption(flavorId, 'Red Velvet')
  const personal = addOption(sizeId, 'Personal')
  const family = addOption(sizeId, 'Family')
  return { productId, coffee, redVelvet, personal, family }
}

describe('products and SKUs', () => {
  it('auto-creates the cartesian SKU matrix from variations and options', () => {
    const { productId } = makeCake()
    const skus = listSkusWithProducts().filter((sku) => sku.productId === productId)
    expect(skus).toHaveLength(4)
    expect(skus.map((sku) => sku.label).sort()).toEqual([
      'Coffee · Family',
      'Coffee · Personal',
      'Red Velvet · Family',
      'Red Velvet · Personal',
    ])
  })

  it('resolves price by price mode and preserves prices when options grow', () => {
    const { productId, coffee, personal } = makeCake()
    const skus = () => listSkusWithProducts().filter((sku) => sku.productId === productId)

    const personalSkus = skus().filter((sku) => sku.optionIds.includes(personal))
    for (const sku of personalSkus) setSkuPrice(sku.id, 80)

    // Adding an option creates new SKUs but keeps existing prices.
    const flavorId = listProducts()[0]!.variations[0]!.id
    const chocolate = addOption(flavorId, 'Chocolate')

    const stillPriced = skus().filter(
      (sku) => sku.optionIds.includes(personal) && sku.optionIds.includes(coffee),
    )
    expect(stillPriced).toHaveLength(1)
    expect(stillPriced[0]!.price).toBe(80)

    const newSkus = skus().filter((sku) => sku.optionIds.includes(chocolate))
    expect(newSkus).toHaveLength(2)
    expect(newSkus.every((sku) => sku.price === null)).toBe(true)
  })

  it('removes SKUs when an option is removed', () => {
    const { productId, coffee } = makeCake()
    expect(listSkusWithProducts().filter((sku) => sku.productId === productId)).toHaveLength(4)
    removeOption(coffee)
    expect(listSkusWithProducts().filter((sku) => sku.productId === productId)).toHaveLength(2)
  })

  it('uses the global price for every SKU in global mode', () => {
    const { productId } = makeCake('global')
    const product = listProducts().find((p) => p.id === productId)!
    for (const sku of listSkusWithProducts().filter((sku) => sku.productId === productId)) {
      expect(priceForSku(product, sku)).toBe(100)
    }
  })

  it('blocks deleting a product that already has sales', () => {
    const { productId } = makeCake()
    expect(productInUse(productId)).toBe(false)
    deleteProduct(productId)
    expect(listProducts()).toHaveLength(0)
  })
})

describe('scheduled tandas', () => {
  function setup() {
    const { productId, redVelvet, personal, coffee, family } = makeCake()
    const personalRv = listSkusWithProducts().find(
      (sku) =>
        sku.productId === productId &&
        sku.optionIds.includes(redVelvet) &&
        sku.optionIds.includes(personal),
    )!
    setSkuPrice(personalRv.id, 90)
    const clientId = createClient('María')
    const tandaId = createTanda({ name: 'Tanda 2026-09-20', date: '2026-09-20', type: 'scheduled' })
    return { productId, personalRv, coffee, family, clientId, tandaId }
  }

  it('creates a pre-production sale with computed totals', () => {
    const { personalRv, clientId, tandaId } = setup()
    const result = createSale({
      tandaId,
      clientId,
      items: [
        { skuId: personalRv.id, quantity: 3 },
        { skuId: personalRv.id, quantity: 1 },
      ],
    })
    expect(result.ok).toBe(true)
    const [sale] = listSales(tandaId)
    expect(sale!.total).toBe(360)
    expect(sale!.balance).toBe(360)
    expect(sale!.delivered).toBe(false)
  })

  it('tracks paid amount via sale-allocated payments and delivery flag', () => {
    const { personalRv, clientId, tandaId } = setup()
    const saleResult = createSale({
      tandaId,
      clientId,
      items: [{ skuId: personalRv.id, quantity: 2 }],
    })
    if (!saleResult.ok) throw new Error('expected sale')
    addPayment({ clientId, saleId: saleResult.saleId, amount: 100, note: null })
    expect(listSales(tandaId)[0]!.paid).toBe(100)
    expect(listSales(tandaId)[0]!.balance).toBe(80)

    setDelivered(saleResult.saleId, true)
    expect(listSales(tandaId)[0]!.delivered).toBe(true)
  })

  it('refuses sales for unpriced SKUs', () => {
    const { productId, coffee, family, clientId } = setup()
    const tandaId = createTanda({ name: 'T2', date: '2026-09-21', type: 'scheduled' })
    const unpriced = listSkusWithProducts().find(
      (sku) =>
        sku.productId === productId &&
        sku.optionIds.includes(coffee) &&
        sku.optionIds.includes(family),
    )!
    const result = createSale({ tandaId, clientId, items: [{ skuId: unpriced.id, quantity: 1 }] })
    expect(result).toEqual({ ok: false, error: '"Cake" has no price set' })
  })

  it('keeps payments when a sale is deleted (they become general)', () => {
    const { personalRv, clientId, tandaId } = setup()
    const saleResult = createSale({
      tandaId,
      clientId,
      items: [{ skuId: personalRv.id, quantity: 1 }],
    })
    if (!saleResult.ok) throw new Error('expected sale')
    addPayment({ clientId, saleId: saleResult.saleId, amount: 50, note: null })
    deleteSale(saleResult.saleId)
    const client = listClients().find((c) => c.id === clientId)!
    // Payment survives as a general abono: 0 sales - 50 paid = -50 credit.
    expect(client.balance).toBe(-50)
  })
})

describe('anticipated tandas', () => {
  function setup() {
    const { productId, redVelvet, personal, family, coffee } = makeCake()
    const skus = listSkusWithProducts().filter((sku) => sku.productId === productId)
    for (const sku of skus) setSkuPrice(sku.id, 100)
    const rvPersonal = skus.find(
      (s) => s.optionIds.includes(redVelvet) && s.optionIds.includes(personal),
    )!
    const rvFamily = skus.find(
      (s) => s.optionIds.includes(redVelvet) && s.optionIds.includes(family),
    )!
    const chocoPersonal = skus.find(
      (s) => s.optionIds.includes(coffee) && s.optionIds.includes(personal),
    )!
    const clientId = createClient('José')
    const tandaId = createTanda({
      name: 'Tanda 2026-09-15',
      date: '2026-09-15',
      type: 'anticipated',
    })
    setInventoryQuantity(tandaId, rvPersonal.id, 4)
    setInventoryQuantity(tandaId, rvFamily.id, 4)
    setInventoryQuantity(tandaId, chocoPersonal.id, 2)
    return { productId, rvPersonal, rvFamily, chocoPersonal, coffee, family, clientId, tandaId }
  }

  it('tracks produced / sold / available per SKU', () => {
    const { rvFamily, clientId, tandaId } = setup()
    createSale({ tandaId, clientId, items: [{ skuId: rvFamily.id, quantity: 1 }] })
    const inventory = listInventory(tandaId)
    const rvFamilyEntry = inventory.find((entry) => entry.sku.id === rvFamily.id)!
    expect(rvFamilyEntry.produced).toBe(4)
    expect(rvFamilyEntry.sold).toBe(1)
    expect(rvFamilyEntry.available).toBe(3)
  })

  it('refuses to sell more than produced — including per-SKU combos', () => {
    const { rvPersonal, clientId, tandaId } = setup()
    const tooMany = createSale({
      tandaId,
      clientId,
      items: [{ skuId: rvPersonal.id, quantity: 5 }],
    })
    expect(tooMany.ok).toBe(false)

    // 4 available + separate sale of 1 = 5th unit rejected.
    expect(
      createSale({ tandaId, clientId, items: [{ skuId: rvPersonal.id, quantity: 4 }] }).ok,
    ).toBe(true)
    expect(
      createSale({ tandaId, clientId, items: [{ skuId: rvPersonal.id, quantity: 1 }] }).ok,
    ).toBe(false)
  })

  it('refuses SKUs that were not produced at all for this tanda', () => {
    const { productId, coffee, family, clientId, tandaId } = setup()
    const chocoFamily = listSkusWithProducts().find(
      (sku) =>
        sku.productId === productId &&
        sku.optionIds.includes(coffee) &&
        sku.optionIds.includes(family),
    )!
    const result = createSale({
      tandaId,
      clientId,
      items: [{ skuId: chocoFamily.id, quantity: 1 }],
    })
    expect(result.ok).toBe(false)
  })
})

describe('clients and payments', () => {
  it('combines per-sale payments and general abonos into one balance', () => {
    const { personal, redVelvet } = makeCake()
    const productId = listProducts()[0]!.id
    const rvPersonal = listSkusWithProducts().find(
      (sku) =>
        sku.productId === productId &&
        sku.optionIds.includes(redVelvet) &&
        sku.optionIds.includes(personal),
    )!
    setSkuPrice(rvPersonal.id, 200)
    const clientId = createClient('Ana')
    const tandaId = createTanda({ name: 'T', date: '2026-09-10', type: 'scheduled' })
    const saleResult = createSale({
      tandaId,
      clientId,
      items: [{ skuId: rvPersonal.id, quantity: 1 }],
    })
    if (!saleResult.ok) throw new Error('expected sale')

    // Owes 200.
    expect(listClients()[0]!.balance).toBe(200)

    // Abono toward the sale: 200 - 150 = 50.
    addPayment({ clientId, saleId: saleResult.saleId, amount: 150, note: null })
    expect(listClients()[0]!.balance).toBe(50)

    // General abono covers the rest: 0.
    addPayment({ clientId, saleId: null, amount: 50, note: 'cash' })
    expect(listClients()[0]!.balance).toBe(0)
    expect(listClients()[0]!.totalPayments).toBe(200)
  })

  it('advances tanda status forward', () => {
    const tandaId = createTanda({ name: 'T', date: '2026-09-10', type: 'scheduled' })
    setTandaStatus(tandaId, 'production')
    setTandaStatus(tandaId, 'ready')
    expect(getTanda(tandaId)!.status).toBe('ready')
  })
})
