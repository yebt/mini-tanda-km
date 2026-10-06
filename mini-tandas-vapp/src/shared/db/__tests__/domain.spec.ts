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
  resolvePrice,
  setPriceRow,
  setPricingVariations,
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
  updateSale,
} from '../repos/tandas'

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
  return { productId, flavorId, sizeId, coffee, redVelvet, personal, family }
}

/** Walk a tanda forward through the status flow up to `status`. */
function advanceTo(tandaId: string, status: 'production' | 'ready' | 'closed') {
  for (const step of ['production', 'ready', 'closed'] as const) {
    const result = setTandaStatus(tandaId, step)
    if (!result.ok) throw new Error(result.error)
    if (step === status) return
  }
}

/** Price the cake by SIZE only: every flavor shares the size price. */
function priceBySize(productId: string, sizeId: string, prices: Record<string, number>) {
  setPricingVariations(productId, [sizeId])
  for (const [optionId, price] of Object.entries(prices)) {
    setPriceRow(productId, [optionId], price)
  }
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

  it('prices every SKU from a single pricing variation (SIZE only)', () => {
    const { productId, sizeId, coffee, redVelvet, personal, family } = makeCake()
    priceBySize(productId, sizeId, { [personal]: 80, [family]: 120 })

    const priceOf = (...options: string[]) => {
      const product = listProducts().find((p) => p.id === productId)!
      const sku = listSkusWithProducts().find(
        (s) => s.productId === productId && options.every((o) => s.optionIds.includes(o)),
      )!
      return resolvePrice(product, sku)
    }

    expect(priceOf(personal, coffee)).toBe(80)
    expect(priceOf(personal, redVelvet)).toBe(80)
    expect(priceOf(family, coffee)).toBe(120)
  })

  it('covers new options automatically when priced by SIZE only', () => {
    const { productId, flavorId, sizeId, personal } = makeCake()
    priceBySize(productId, sizeId, { [personal]: 80 })

    const chocolate = addOption(flavorId, 'Chocolate')
    const product = listProducts().find((p) => p.id === productId)!
    const chocoPersonal = listSkusWithProducts().find(
      (s) =>
        s.productId === productId &&
        s.optionIds.includes(chocolate) &&
        s.optionIds.includes(personal),
    )!
    expect(resolvePrice(product, chocoPersonal)).toBe(80)
  })

  it('requires explicit rows for every combo when priced by two variations', () => {
    const { productId, flavorId, sizeId, coffee, redVelvet, personal, family } = makeCake()
    setPricingVariations(productId, [sizeId, flavorId])
    setPriceRow(productId, [personal, coffee], 90)
    setPriceRow(productId, [family, redVelvet], 150)

    const product = listProducts().find((p) => p.id === productId)!
    const find = (...options: string[]) =>
      listSkusWithProducts().find(
        (s) => s.productId === productId && options.every((o) => s.optionIds.includes(o)),
      )!

    expect(resolvePrice(product, find(personal, coffee))).toBe(90)
    expect(resolvePrice(product, find(family, redVelvet))).toBe(150)
    // No row for family × coffee.
    expect(resolvePrice(product, find(family, coffee))).toBeNull()
  })

  it('prunes price rows when the pricing variations change', () => {
    const { productId, flavorId, sizeId, coffee, personal } = makeCake()
    setPricingVariations(productId, [sizeId, flavorId])
    setPriceRow(productId, [personal, coffee], 90)

    // Back to SIZE-only: the flavor-specific row is dropped.
    setPricingVariations(productId, [sizeId])
    expect(listProducts().find((p) => p.id === productId)!.priceVariationIds).toEqual([sizeId])

    const product = listProducts().find((p) => p.id === productId)!
    const coffeePersonal = listSkusWithProducts().find(
      (s) =>
        s.productId === productId && s.optionIds.includes(coffee) && s.optionIds.includes(personal),
    )!
    expect(resolvePrice(product, coffeePersonal)).toBeNull()
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
      expect(resolvePrice(product, sku)).toBe(100)
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
    const { productId, sizeId, redVelvet, personal, coffee, family } = makeCake()
    // Priced by SIZE only; family intentionally unpriced for the refusal test.
    priceBySize(productId, sizeId, { [personal]: 90 })
    const personalRv = listSkusWithProducts().find(
      (sku) =>
        sku.productId === productId &&
        sku.optionIds.includes(redVelvet) &&
        sku.optionIds.includes(personal),
    )!
    const clientId = createClient('María')
    const tandaId = createTanda({
      name: 'Tanda 2026-09-20',
      date: '2026-09-20',
      type: 'scheduled',
    })
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

    advanceTo(tandaId, 'ready')
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
    const { productId, sizeId, redVelvet, personal, family, coffee } = makeCake()
    priceBySize(productId, sizeId, { [personal]: 100, [family]: 100 })
    const skus = listSkusWithProducts().filter((sku) => sku.productId === productId)
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
    // Anticipated tandas sell once production is done.
    advanceTo(tandaId, 'ready')
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

describe('editing sales', () => {
  function setup() {
    const { productId, sizeId, redVelvet, personal, family, coffee } = makeCake()
    priceBySize(productId, sizeId, { [personal]: 90, [family]: 110 })
    const skus = listSkusWithProducts().filter((sku) => sku.productId === productId)
    const pick = (...options: string[]) =>
      skus.find((sku) => options.every((option) => sku.optionIds.includes(option)))!
    const clientId = createClient('María')
    const tandaId = createTanda({ name: 'T', date: '2026-09-20', type: 'scheduled' })
    return {
      productId,
      sizeId,
      personal,
      personalRv: pick(redVelvet, personal),
      familyRv: pick(redVelvet, family),
      chocoPersonal: pick(coffee, personal),
      clientId,
      tandaId,
    }
  }

  it('adds a missing product to an existing sale and keeps original line prices', () => {
    const { productId, personal, personalRv, familyRv, clientId, tandaId } = setup()
    const saleResult = createSale({
      tandaId,
      clientId,
      items: [{ skuId: personalRv.id, quantity: 2 }],
    })
    if (!saleResult.ok) throw new Error('expected sale')

    // Admin raises the price after the sale exists; the old line must not reprice.
    setPriceRow(productId, [personal], 150)

    const edited = updateSale(saleResult.saleId, [
      { skuId: personalRv.id, quantity: 2 },
      { skuId: familyRv.id, quantity: 1 },
    ])
    expect(edited.ok).toBe(true)

    const [sale] = listSales(tandaId)
    expect(sale!.items).toHaveLength(2)
    expect(sale!.total).toBe(2 * 90 + 110)
    expect(sale!.balance).toBe(290)
  })

  it('removing every product is rejected instead of leaving an empty sale', () => {
    const { personalRv, clientId, tandaId } = setup()
    const saleResult = createSale({
      tandaId,
      clientId,
      items: [{ skuId: personalRv.id, quantity: 1 }],
    })
    if (!saleResult.ok) throw new Error('expected sale')
    expect(updateSale(saleResult.saleId, [])).toEqual({
      ok: false,
      error: 'Add at least one product',
    })
    expect(updateSale('missing-id', [{ skuId: personalRv.id, quantity: 1 }])).toEqual({
      ok: false,
      error: 'Sale not found',
    })
  })

  it('resolves the current price only for newly added SKUs and refuses unpriced ones', () => {
    const { productId, personal, personalRv, chocoPersonal, clientId, tandaId } = setup()
    const saleResult = createSale({
      tandaId,
      clientId,
      items: [{ skuId: personalRv.id, quantity: 1 }],
    })
    if (!saleResult.ok) throw new Error('expected sale')

    setPriceRow(productId, [personal], 95)
    expect(
      updateSale(saleResult.saleId, [
        { skuId: personalRv.id, quantity: 1 },
        { skuId: chocoPersonal.id, quantity: 1 },
      ]).ok,
    ).toBe(true)
    // Old line keeps 90, the new line takes today's 95.
    expect(listSales(tandaId)[0]!.total).toBe(90 + 95)

    setPriceRow(productId, [personal], null)
    const withUnknown = updateSale(saleResult.saleId, [
      { skuId: personalRv.id, quantity: 1 },
      { skuId: 'unknown-sku', quantity: 1 },
    ])
    expect(withUnknown).toEqual({ ok: false, error: 'Unknown product' })
    // Removing a priced line and keeping the snapshot one still works without a current price.
    expect(updateSale(saleResult.saleId, [{ skuId: personalRv.id, quantity: 3 }]).ok).toBe(true)
    expect(listSales(tandaId)[0]!.total).toBe(270)
  })

  it('lets an anticipated sale keep its own stock while editing, but not exceed it', () => {
    const { personalRv, clientId } = setup()
    const tandaId = createTanda({ name: 'TA', date: '2026-09-22', type: 'anticipated' })
    const rvPersonal = personalRv
    setInventoryQuantity(tandaId, rvPersonal.id, 4)
    advanceTo(tandaId, 'ready')

    const saleResult = createSale({
      tandaId,
      clientId,
      items: [{ skuId: rvPersonal.id, quantity: 4 }],
    })
    if (!saleResult.ok) throw new Error('expected sale')

    // Keeping all 4 must not fail against itself…
    expect(updateSale(saleResult.saleId, [{ skuId: rvPersonal.id, quantity: 4 }]).ok).toBe(true)
    // …but a 5th unit is still refused.
    expect(updateSale(saleResult.saleId, [{ skuId: rvPersonal.id, quantity: 5 }]).ok).toBe(false)

    // Shrinking the sale frees stock for other sales.
    expect(updateSale(saleResult.saleId, [{ skuId: rvPersonal.id, quantity: 2 }]).ok).toBe(true)
    expect(
      createSale({ tandaId, clientId, items: [{ skuId: rvPersonal.id, quantity: 2 }] }).ok,
    ).toBe(true)
    expect(listInventory(tandaId)[0]!.available).toBe(0)
  })
})

describe('database migration v0 → v1', () => {
  it('moves legacy skus.price into sku_prices without losing data', async () => {
    const SQL = await initSqlJs()
    const legacy = new SQL.Database()
    // Recreate the pre-v1 schema shape.
    legacy.run(`
      CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        photo TEXT, price_mode TEXT NOT NULL DEFAULT 'global', price REAL);
      CREATE TABLE variations (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE variation_options (id TEXT PRIMARY KEY, variation_id TEXT NOT NULL,
        label TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE skus (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, option_ids TEXT NOT NULL,
        price REAL);
      INSERT INTO products VALUES ('p1', 'Cake', NULL, NULL, 'per_sku', NULL);
      INSERT INTO variations VALUES ('v1', 'p1', 'SIZE', 0);
      INSERT INTO variation_options VALUES ('o1', 'v1', 'Personal', 0), ('o2', 'v1', 'Family', 1);
      INSERT INTO skus VALUES ('s1', 'p1', '["o1"]', 80), ('s2', 'p1', '["o2"]', 120);
    `)

    openWithInstance(legacy)

    // Prices survived the migration and resolve once SIZE drives pricing.
    setPricingVariations('p1', ['v1'])
    const product = listProducts().find((p) => p.id === 'p1')!
    const byOption = (optionId: string) =>
      listSkusWithProducts().find((s) => s.productId === 'p1' && s.optionIds.includes(optionId))!
    expect(resolvePrice(product, byOption('o1'))).toBe(80)
    expect(resolvePrice(product, byOption('o2'))).toBe(120)
  })
})

describe('clients and payments', () => {
  it('combines per-sale payments and general abonos into one balance', () => {
    const { productId, sizeId, personal, redVelvet } = makeCake()
    priceBySize(productId, sizeId, { [personal]: 200 })
    const rvPersonal = listSkusWithProducts().find(
      (sku) =>
        sku.productId === productId &&
        sku.optionIds.includes(redVelvet) &&
        sku.optionIds.includes(personal),
    )!
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
    advanceTo(tandaId, 'ready')
    expect(getTanda(tandaId)!.status).toBe('ready')
  })
})

describe('tanda status rules enforced by repos', () => {
  function setup(type: 'scheduled' | 'anticipated') {
    const { productId, sizeId, redVelvet, personal } = makeCake()
    priceBySize(productId, sizeId, { [personal]: 100 })
    const sku = listSkusWithProducts().find(
      (s) =>
        s.productId === productId &&
        s.optionIds.includes(redVelvet) &&
        s.optionIds.includes(personal),
    )!
    const clientId = createClient('Eva')
    const tandaId = createTanda({ name: 'T', date: '2026-09-30', type })
    return { sku, clientId, tandaId }
  }

  it('refuses scheduled sales once the tanda leaves open', () => {
    const { sku, clientId, tandaId } = setup('scheduled')
    const sale = createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 1 }] })
    expect(sale.ok).toBe(true)
    expect(setTandaStatus(tandaId, 'production')).toEqual({ ok: true })

    expect(createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 1 }] })).toEqual({
      ok: false,
      error: 'Sales are closed for this tanda',
    })
    if (!sale.ok) throw new Error('expected sale')
    expect(updateSale(sale.saleId, [{ skuId: sku.id, quantity: 2 }])).toEqual({
      ok: false,
      error: 'Sales are closed for this tanda',
    })
  })

  it('refuses anticipated sales before the tanda is ready', () => {
    const { sku, clientId, tandaId } = setup('anticipated')
    expect(setInventoryQuantity(tandaId, sku.id, 3)).toEqual({ ok: true })
    expect(createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 1 }] }).ok).toBe(
      false,
    )
    setTandaStatus(tandaId, 'production')
    expect(createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 1 }] }).ok).toBe(
      false,
    )
    setTandaStatus(tandaId, 'ready')
    expect(createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 1 }] }).ok).toBe(true)
  })

  it('refuses inventory edits unless the anticipated tanda is open', () => {
    const { sku, tandaId } = setup('anticipated')
    setTandaStatus(tandaId, 'production')
    expect(setInventoryQuantity(tandaId, sku.id, 3)).toEqual({
      ok: false,
      error: 'Inventory can only be edited while the tanda is open',
    })
    expect(listInventory(tandaId)).toHaveLength(0)

    const scheduled = setup('scheduled')
    expect(setInventoryQuantity(scheduled.tandaId, scheduled.sku.id, 3).ok).toBe(false)
  })

  it('refuses marking delivery before the tanda is ready', () => {
    const { sku, clientId, tandaId } = setup('scheduled')
    const sale = createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 1 }] })
    if (!sale.ok) throw new Error('expected sale')

    expect(setDelivered(sale.saleId, true)).toEqual({
      ok: false,
      error: 'Delivery can only be marked once the tanda is ready',
    })
    expect(listSales(tandaId)[0]!.delivered).toBe(false)

    setTandaStatus(tandaId, 'production')
    setTandaStatus(tandaId, 'ready')
    expect(setDelivered(sale.saleId, true)).toEqual({ ok: true })
    expect(listSales(tandaId)[0]!.delivered).toBe(true)
  })

  it('only moves the status one step forward or back', () => {
    const { tandaId } = setup('scheduled')
    expect(setTandaStatus(tandaId, 'ready')).toEqual({
      ok: false,
      error: 'Cannot move a tanda from open to ready',
    })
    expect(getTanda(tandaId)!.status).toBe('open')
    expect(setTandaStatus(tandaId, 'production')).toEqual({ ok: true })
    expect(setTandaStatus(tandaId, 'open')).toEqual({ ok: true })
    expect(setTandaStatus('missing', 'production')).toEqual({ ok: false, error: 'Tanda not found' })
  })
})
