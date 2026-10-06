import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { createProduct, getProduct, listProductsMissingThumbnail, updateProduct } from '@shared/db/repos/products'

import { backfillThumbnails, coverCropRect, createThumbnail } from '../thumbnail'

const PHOTO = 'data:image/jpeg;base64,AAAA'

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
})

function productWithPhoto(name: string): string {
  return createProduct({ name, description: null, photo: PHOTO, priceMode: 'global', price: 1 })
}

describe('coverCropRect', () => {
  it('takes the centered square of landscape and portrait images', () => {
    expect(coverCropRect(400, 200)).toEqual({ x: 100, y: 0, size: 200 })
    expect(coverCropRect(200, 401)).toEqual({ x: 0, y: 101, size: 200 })
    expect(coverCropRect(160, 160)).toEqual({ x: 0, y: 0, size: 160 })
  })
})

describe('createThumbnail', () => {
  it('resolves null where there is no canvas (tests, Node)', async () => {
    await expect(createThumbnail(PHOTO)).resolves.toBeNull()
  })
})

describe('backfillThumbnails', () => {
  it('stores a thumbnail for every photo that lacks one, in a single write', async () => {
    const a = productWithPhoto('A')
    const b = productWithPhoto('B')
    const make = vi.fn<(photo: string) => Promise<string | null>>(
      async (photo) => `thumb:${photo.length}`,
    )

    await expect(backfillThumbnails(make)).resolves.toBe(2)

    expect(make).toHaveBeenCalledTimes(2)
    expect(getProduct(a)!.thumbnail).toBe(`thumb:${PHOTO.length}`)
    expect(getProduct(b)!.thumbnail).toBe(`thumb:${PHOTO.length}`)
    expect(listProductsMissingThumbnail()).toEqual([])
  })

  it('leaves products without a generated thumbnail queued for the next run', async () => {
    productWithPhoto('A')
    await expect(backfillThumbnails(async () => null)).resolves.toBe(0)
    expect(listProductsMissingThumbnail()).toHaveLength(1)
  })

  it('never overwrites a thumbnail saved while the backfill was running', async () => {
    const id = productWithPhoto('A')
    await backfillThumbnails(async () => {
      updateProduct(id, {
        name: 'A',
        description: null,
        photo: PHOTO,
        thumbnail: 'fresh',
        priceMode: 'global',
        price: 1,
      })
      return 'stale'
    })
    expect(getProduct(id)!.thumbnail).toBe('fresh')
  })
})
