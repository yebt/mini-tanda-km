import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { DATA_DOMAINS, domainsOf, domainVersion, openWithInstance, transaction, run } from '@shared/db/database'
import * as clientsRepo from '@shared/db/repos/clients'
import * as productsRepo from '@shared/db/repos/products'
import * as tandasRepo from '@shared/db/repos/tandas'

import { useClientsStore } from '../clients'
import { useProductsStore } from '../products'
import { useSettingsStore } from '../settings'
import { useTandasStore } from '../tandas'

// Wrap the list queries so recomputations can be counted.
vi.mock('@shared/db/repos/products', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/db/repos/products')>()
  return { ...actual, listProducts: vi.fn<typeof actual.listProducts>(actual.listProducts) }
})
vi.mock('@shared/db/repos/tandas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/db/repos/tandas')>()
  return { ...actual, listTandas: vi.fn<typeof actual.listTandas>(actual.listTandas) }
})
vi.mock('@shared/db/repos/clients', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/db/repos/clients')>()
  return { ...actual, listClients: vi.fn<typeof actual.listClients>(actual.listClients) }
})

const listProducts = vi.mocked(productsRepo.listProducts)
const listTandas = vi.mocked(tandasRepo.listTandas)
const listClients = vi.mocked(clientsRepo.listClients)

let productId: string
let skuId: string
let clientId: string
let tandaId: string

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  productId = productsRepo.createProduct({
    name: 'Cake',
    description: null,
    priceMode: 'global',
    price: 100,
  })
  skuId = productsRepo.listSkus(productId)[0]!.id
  clientId = clientsRepo.createClient('Ana')
  tandaId = tandasRepo.createTanda({ name: 'T', date: '2026-10-10', type: 'scheduled' })
})

/** Read every list computed once, then reset the query counters. */
function primeStores() {
  const stores = {
    products: useProductsStore(),
    tandas: useTandasStore(),
    clients: useClientsStore(),
  }
  void stores.products.catalog
  void stores.tandas.tandas
  void stores.clients.clients
  listProducts.mockClear()
  listTandas.mockClear()
  listClients.mockClear()
  return stores
}

describe('per-domain invalidation', () => {
  it('a product write recomputes products only, not tandas or clients', () => {
    const { products, tandas, clients } = primeStores()

    products.saveProduct({
      id: productId,
      name: 'Cake XL',
      description: null,
      priceMode: 'global',
      price: 100,
    })

    expect(products.catalog[0]!.product.name).toBe('Cake XL')
    void tandas.tandas
    void clients.clients
    expect(listProducts).toHaveBeenCalledTimes(1)
    expect(listTandas).not.toHaveBeenCalled()
    expect(listClients).not.toHaveBeenCalled()
  })

  it('a sale updates tanda revenue and client balances without reloading products', () => {
    const { products, tandas, clients } = primeStores()

    const sale = tandas.addSale({ tandaId, clientId, items: [{ skuId, quantity: 2 }] })
    expect(sale.ok).toBe(true)

    expect(tandas.tandas[0]!.revenue).toBe(200)
    expect(clients.clients[0]!.balance).toBe(200)
    void products.catalog
    expect(listProducts).not.toHaveBeenCalled()
  })

  it('a payment updates client balances and tanda pending amounts', () => {
    const { tandas, clients } = primeStores()
    const sale = tandas.addSale({ tandaId, clientId, items: [{ skuId, quantity: 1 }] })
    if (!sale.ok) throw new Error(sale.error)
    expect(tandas.tandas[0]!.pendingBalance).toBe(100)

    clients.pay({ clientId, saleId: sale.saleId, amount: 40, note: null })

    expect(clients.clients[0]!.balance).toBe(60)
    expect(tandas.tandas[0]!.pendingBalance).toBe(60)
    expect(clients.paymentsFor(clientId)).toHaveLength(1)
  })

  it('a client write does not recompute tandas or products', () => {
    const { products, tandas, clients } = primeStores()

    clients.addClient('Beto')

    expect(clients.clients.map((c) => c.name)).toEqual(['Ana', 'Beto'])
    void tandas.tandas
    void products.catalog
    expect(listTandas).not.toHaveBeenCalled()
    expect(listProducts).not.toHaveBeenCalled()
  })

  it('an import refreshes every domain', () => {
    const { products, tandas, clients } = primeStores()
    const settings = useSettingsStore()

    settings.importBackup({ data: { clients: [{ id: 'c9', name: 'Zoe', created_at: 'now' }] } })

    expect(products.catalog).toEqual([])
    expect(tandas.tandas).toEqual([])
    expect(clients.clients.map((c) => c.name)).toEqual(['Zoe'])
  })
})

describe('write attribution', () => {
  it('maps each written table to its domain and unknown writes to all domains', () => {
    expect(domainsOf('INSERT OR REPLACE INTO product_photos (product_id) VALUES (?)')).toEqual([
      'products',
    ])
    expect(domainsOf('UPDATE sales SET delivered = 1')).toEqual(['sales'])
    expect(domainsOf('DELETE FROM payments WHERE id = ?')).toEqual(['payments'])
    expect(domainsOf('PRAGMA user_version = 9')).toEqual(DATA_DOMAINS)
  })

  it('bumps nothing when a transaction rolls back', () => {
    const before = domainVersion('clients')
    expect(() =>
      transaction(() => {
        run("INSERT INTO clients (id, name, created_at) VALUES ('x', 'X', 'now')")
        throw new Error('abort')
      }),
    ).toThrow('abort')
    expect(domainVersion('clients')).toBe(before)
  })
})
