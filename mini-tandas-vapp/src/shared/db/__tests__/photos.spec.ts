import { beforeEach, describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'

import { all, exportPayload, importAllData, openWithInstance, SCHEMA_VERSION } from '../database'
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProductPhoto,
  listProducts,
  listProductsMissingThumbnail,
  setProductThumbnail,
  updateProduct,
} from '../repos/products'

const PHOTO = `data:image/jpeg;base64,${'A'.repeat(2048)}`
const THUMB = 'data:image/webp;base64,dGh1bWI='

async function freshDb() {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
}

beforeEach(freshDb)

function product(overrides: Partial<Parameters<typeof createProduct>[0]> = {}) {
  return createProduct({
    name: 'Cake',
    description: null,
    photo: null,
    priceMode: 'global',
    price: 10,
    ...overrides,
  })
}

describe('product photos', () => {
  it('keeps the full photo out of list queries and serves the thumbnail instead', () => {
    const id = product({ photo: PHOTO, thumbnail: THUMB })

    const listed = listProducts()[0]!
    expect(listed).not.toHaveProperty('photo')
    expect(listed.thumbnail).toBe(THUMB)
    expect(getProduct(id)!.thumbnail).toBe(THUMB)
    // The editor reads the full image on demand.
    expect(getProductPhoto(id)).toBe(PHOTO)
    expect(all('SELECT product_id FROM product_photos')).toEqual([{ product_id: id }])
  })

  it('keeps the stored photo when an update does not send one, and removes it on null', () => {
    const id = product({ photo: PHOTO, thumbnail: THUMB })

    updateProduct(id, { name: 'Cake 2', description: null, priceMode: 'global', price: 10 })
    expect(getProductPhoto(id)).toBe(PHOTO)
    expect(getProduct(id)!.thumbnail).toBe(THUMB)

    updateProduct(id, { name: 'Cake 2', description: null, photo: null, priceMode: 'global', price: 10 })
    expect(getProductPhoto(id)).toBeNull()
    expect(getProduct(id)!.thumbnail).toBeNull()
  })

  it('queues a new photo saved without a thumbnail for backfill', () => {
    const id = product()
    updateProduct(id, { name: 'Cake', description: null, photo: PHOTO, priceMode: 'global', price: 10 })

    expect(getProduct(id)!.thumbnail).toBeNull()
    expect(listProductsMissingThumbnail()).toEqual([id])

    setProductThumbnail(id, THUMB)
    expect(getProduct(id)!.thumbnail).toBe(THUMB)
    expect(listProductsMissingThumbnail()).toEqual([])
  })

  it('removes the photo row with its product', () => {
    const id = product({ photo: PHOTO, thumbnail: THUMB })
    deleteProduct(id)
    expect(getProductPhoto(id)).toBeNull()
    expect(all('SELECT * FROM product_photos')).toEqual([])
  })
})

describe('database migration to v4 (photos table)', () => {
  it('moves legacy products.photo into product_photos and drops the column', async () => {
    const SQL = await initSqlJs()
    const legacy = new SQL.Database()
    legacy.run(`
      CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        photo TEXT, price_mode TEXT NOT NULL DEFAULT 'global', price INTEGER,
        price_variation_ids TEXT);
      INSERT INTO products VALUES ('p1', 'Cake', NULL, '${PHOTO}', 'global', 1000, '[]');
      INSERT INTO products VALUES ('p2', 'Pie', NULL, NULL, 'global', 500, '[]');
      PRAGMA user_version = 3;
    `)

    openWithInstance(legacy)

    expect(all<{ user_version: number }>('PRAGMA user_version')[0]!.user_version).toBe(
      SCHEMA_VERSION,
    )
    const columns = all<{ name: string }>('PRAGMA table_info(products)').map((c) => c.name)
    expect(columns).not.toContain('photo')
    expect(columns).toContain('thumbnail')
    expect(getProductPhoto('p1')).toBe(PHOTO)
    expect(getProductPhoto('p2')).toBeNull()
    expect(listProductsMissingThumbnail()).toEqual(['p1'])
  })
})

describe('photos in backups', () => {
  it('exports and re-imports the photos table', async () => {
    const id = product({ photo: PHOTO, thumbnail: THUMB })
    const exported = JSON.parse(JSON.stringify(exportPayload()))
    expect(exported.data.product_photos).toEqual([{ product_id: id, data: PHOTO }])

    await freshDb()
    importAllData(exported)

    expect(getProductPhoto(id)).toBe(PHOTO)
    expect(getProduct(id)!.thumbnail).toBe(THUMB)
  })

  it('imports old backups that keep the photo on the product row', () => {
    importAllData({
      app: 'mini-tanda',
      schemaVersion: 3,
      data: {
        products: [
          {
            id: 'p1',
            name: 'Cake',
            description: null,
            photo: PHOTO,
            price_mode: 'global',
            price: 1000,
            price_variation_ids: '[]',
          },
        ],
      },
    })

    expect(getProductPhoto('p1')).toBe(PHOTO)
    expect(getProduct('p1')!.thumbnail).toBeNull()
    expect(listProductsMissingThumbnail()).toEqual(['p1'])
  })
})
