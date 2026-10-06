import { beforeEach, describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'

import { all, exportAllData, importAllData, openWithInstance } from '../database'
import { addPayment, createClient } from '../repos/clients'
import {
  addOption,
  addVariation,
  createProduct,
  setPriceRow,
  setPricingVariations,
} from '../repos/products'
import { createSale, createTanda } from '../repos/tandas'
import { listSkusWithProducts } from '../repos/products'

async function freshDb() {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
}

beforeEach(freshDb)

function seed() {
  const productId = createProduct({
    name: 'Cake',
    description: 'Chocolate',
    photo: null,
    priceMode: 'per_sku',
    price: null,
  })
  const sizeId = addVariation(productId, 'SIZE')
  const personal = addOption(sizeId, 'Personal')
  setPricingVariations(productId, [sizeId])
  setPriceRow(productId, [personal], 89.9)
  const sku = listSkusWithProducts()[0]!
  const clientId = createClient('María')
  const tandaId = createTanda({ name: 'T', date: '2026-09-20', type: 'scheduled' })
  const sale = createSale({ tandaId, clientId, items: [{ skuId: sku.id, quantity: 3 }] })
  if (!sale.ok) throw new Error(sale.error)
  addPayment({ clientId, saleId: sale.saleId, amount: 100.5, note: 'cash' })
}

describe('export → import round trip', () => {
  it('restores exactly the exported data into an empty database', async () => {
    seed()
    const exported = JSON.parse(
      JSON.stringify({ app: 'mini-tanda', exportedAt: 'now', data: exportAllData() }),
    )

    await freshDb()
    const inserted = importAllData(exported)

    expect(inserted).toBeGreaterThan(0)
    expect(exportAllData()).toEqual(exported.data)
  })
})

describe('import hardening', () => {
  it('never interpolates unknown column names into SQL', async () => {
    const payload = {
      data: {
        clients: [
          {
            id: 'c1',
            name: 'Ana',
            created_at: '2026-01-01T00:00:00.000Z',
            "name) VALUES ('x', 'y', 'z'); DROP TABLE clients; --": 'boom',
          },
        ],
      },
    }

    expect(importAllData(payload)).toBe(1)
    expect(all('SELECT id, name FROM clients')).toEqual([{ id: 'c1', name: 'Ana' }])
    expect(
      all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'clients'"),
    ).toHaveLength(1)
  })

  it('rejects rows that are not plain objects and leaves current data untouched', () => {
    createClient('Keep me')
    expect(() => importAllData({ data: { clients: ['oops'] } })).toThrow(/Invalid row/)
    expect(all<{ name: string }>('SELECT name FROM clients')).toEqual([{ name: 'Keep me' }])
  })

  it('still rejects unknown tables', () => {
    expect(() => importAllData({ data: { evil: [] } })).toThrow(/Unrecognized tables/)
  })
})
