import { beforeEach, describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'

import { all, exportPayload, get, importAllData, openWithInstance, SCHEMA_VERSION } from '../database'
import { fromCents, toCents } from '../money'
import { addPayment, createClient, listClients, listPayments } from '../repos/clients'
import {
  addOption,
  addVariation,
  createProduct,
  listPriceRows,
  listProducts,
  listSkusWithProducts,
  setPriceRow,
  setPricingVariations,
} from '../repos/products'
import { createSale, createTanda, listSales, listTandas } from '../repos/tandas'

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
})

describe('toCents / fromCents', () => {
  it('rounds to the nearest cent', () => {
    expect(toCents(89.9)).toBe(8990)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(19.999)).toBe(2000)
    expect(toCents(1.005)).toBe(101)
    expect(toCents(-12.5)).toBe(-1250)
  })

  it('converts cents back to currency units', () => {
    expect(fromCents(8990)).toBe(89.9)
    expect(fromCents(0)).toBe(0)
  })
})

/** A one-SKU product with a global price, a client and an open scheduled tanda. */
function setup(price: number) {
  const productId = createProduct({
    name: 'Candy',
    description: null,
    photo: null,
    priceMode: 'global',
    price,
  })
  addOption(addVariation(productId, 'SIZE'), 'Small')
  const sku = listSkusWithProducts().find((s) => s.productId === productId)!
  const clientId = createClient('Ana')
  const tandaId = createTanda({ name: 'T', date: '2026-09-01', type: 'scheduled' })
  return { productId, sku, clientId, tandaId }
}

describe('money stored as integer cents', () => {
  it('keeps the public API in currency units while the database holds cents', () => {
    const { productId, sku } = setup(89.9)
    expect(listProducts()[0]!.price).toBe(89.9)
    expect(sku.price).toBe(89.9)
    expect(get('SELECT price FROM products WHERE id = ?', [productId])).toEqual({ price: 8990 })

    setPricingVariations(productId, [])
    setPriceRow(productId, ['x'], 12.34)
    expect(listPriceRows(productId)[0]!.price).toBe(12.34)
    expect(get('SELECT price FROM sku_prices')).toEqual({ price: 1234 })
  })

  it('totals, balances and revenue add up exactly (no floating point drift)', () => {
    const { sku, clientId, tandaId } = setup(0.1)
    const sale = createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 3 }] })
    if (!sale.ok) throw new Error(sale.error)
    expect(get('SELECT unit_price FROM sale_items')).toEqual({ unit_price: 10 })

    addPayment({ clientId, saleId: sale.saleId, amount: 0.1, note: null })
    addPayment({ clientId, saleId: null, amount: 0.2, note: null })

    const [details] = listSales(tandaId)
    expect(details!.items[0]!.unitPrice).toBe(0.1)
    expect(details!.items[0]!.lineTotal).toBe(0.3)
    expect(details!.total).toBe(0.3)
    expect(details!.paid).toBe(0.1)
    expect(details!.balance).toBe(0.2)

    const tanda = listTandas().find((t) => t.id === tandaId)!
    expect(tanda.revenue).toBe(0.3)
    expect(tanda.pendingBalance).toBe(0.2)

    const client = listClients()[0]!
    expect(client.totalSales).toBe(0.3)
    expect(client.totalPayments).toBe(0.3)
    expect(client.balance).toBe(0)
    expect(
      listPayments()
        .map((p) => p.amount)
        .sort(),
    ).toEqual([0.1, 0.2])
    expect(all('SELECT amount FROM payments ORDER BY amount')).toEqual([
      { amount: 10 },
      { amount: 20 },
    ])
  })
})

describe('database migration v1 → v2 (REAL → integer cents)', () => {
  it('converts existing money values with rounding', async () => {
    const SQL = await initSqlJs()
    const legacy = new SQL.Database()
    openWithInstance(legacy)
    // Simulate a v1 database holding REAL currency values.
    legacy.run(`
      INSERT INTO products (id, name, price_mode, price, price_variation_ids)
        VALUES ('p1', 'Cake', 'global', 89.9, '[]'), ('p2', 'Pie', 'per_sku', NULL, '[]');
      INSERT INTO sku_prices (id, product_id, option_ids, price) VALUES ('r1', 'p2', '[]', 12.345);
      INSERT INTO clients (id, name, created_at) VALUES ('c1', 'Ana', 'now');
      INSERT INTO tandas (id, name, date, type, status, created_at)
        VALUES ('t1', 'T', '2026-01-01', 'scheduled', 'open', 'now');
      INSERT INTO sales (id, tanda_id, client_id, delivered, created_at)
        VALUES ('s1', 't1', 'c1', 0, 'now');
      INSERT INTO sale_items (id, sale_id, sku_id, quantity, unit_price)
        VALUES ('i1', 's1', 'sku', 3, 0.1);
      INSERT INTO payments (id, client_id, sale_id, amount, note, created_at)
        VALUES ('pay1', 'c1', 's1', 0.3, NULL, 'now');
      PRAGMA user_version = 1;
    `)

    openWithInstance(legacy)

    expect(get('PRAGMA user_version')).toEqual({ user_version: SCHEMA_VERSION })
    expect(all('SELECT price FROM products ORDER BY id')).toEqual([
      { price: 8990 },
      { price: null },
    ])
    expect(get('SELECT price FROM sku_prices')).toEqual({ price: 1235 })
    expect(get('SELECT unit_price FROM sale_items')).toEqual({ unit_price: 10 })
    expect(get('SELECT amount FROM payments')).toEqual({ amount: 30 })
    expect(listSales('t1')[0]!.balance).toBe(0)

    // Re-opening is idempotent: values are not multiplied twice.
    openWithInstance(legacy)
    expect(get('SELECT amount FROM payments')).toEqual({ amount: 30 })
  })
})

describe('backup compatibility', () => {
  it('exports cents with a schema version and round-trips them unchanged', async () => {
    const { sku, clientId, tandaId } = setup(89.9)
    createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 2 }] })
    const payload = JSON.parse(JSON.stringify(exportPayload()))
    expect(payload).toMatchObject({ app: 'mini-tanda', schemaVersion: SCHEMA_VERSION })

    const SQL = await initSqlJs()
    openWithInstance(new SQL.Database())
    importAllData(payload)
    expect(listSales(tandaId)[0]!.total).toBe(179.8)
  })

  it('imports old backups (REAL currency values, no schema version) as cents', () => {
    const oldBackup = {
      app: 'mini-tanda',
      exportedAt: '2026-09-01T00:00:00.000Z',
      data: {
        products: [
          {
            id: 'p1',
            name: 'Cake',
            description: null,
            photo: null,
            price_mode: 'global',
            price: 89.9,
            price_variation_ids: '[]',
          },
        ],
        clients: [{ id: 'c1', name: 'Ana', created_at: 'now' }],
        tandas: [
          {
            id: 't1',
            name: 'T',
            date: '2026-01-01',
            type: 'scheduled',
            status: 'open',
            created_at: 'now',
          },
        ],
        sales: [{ id: 's1', tanda_id: 't1', client_id: 'c1', delivered: 0, created_at: 'now' }],
        sale_items: [{ id: 'i1', sale_id: 's1', sku_id: 'x', quantity: 3, unit_price: 0.1 }],
        payments: [
          { id: 'pay1', client_id: 'c1', sale_id: 's1', amount: 0.1, note: null, created_at: 'n' },
        ],
      },
    }

    importAllData(oldBackup)

    expect(get('SELECT price FROM products')).toEqual({ price: 8990 })
    expect(listProducts()[0]!.price).toBe(89.9)
    const [sale] = listSales('t1')
    expect(sale!.total).toBe(0.3)
    expect(sale!.balance).toBe(0.2)
  })
})
