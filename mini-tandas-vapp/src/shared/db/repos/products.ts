import { all, get, run, transaction, uid } from '../database'
import type { Product, Sku, SkuWithProduct, Variation } from '../types'
import { skuLabel } from '../types'

interface ProductRow {
  id: string
  name: string
  description: string | null
  photo: string | null
  price_mode: Product['priceMode']
  price: number | null
}

interface VariationRow {
  id: string
  product_id: string
  name: string
}

interface OptionRow {
  id: string
  variation_id: string
  name: string
  label: string
}

interface SkuRow {
  id: string
  product_id: string
  option_ids: string
  price: number | null
}

function mapProduct(row: ProductRow, variations: Variation[]): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    photo: row.photo,
    priceMode: row.price_mode,
    price: row.price,
    variations,
  }
}

function listVariations(productId: string): Variation[] {
  const variations = all<VariationRow>(
    'SELECT id, product_id, name FROM variations WHERE product_id = ? ORDER BY position, name',
    [productId],
  )
  return variations.map((variation) => ({
    id: variation.id,
    name: variation.name,
    options: all<OptionRow>(
      'SELECT id, variation_id, label FROM variation_options WHERE variation_id = ? ORDER BY position, label',
      [variation.id],
    ).map((option) => ({ id: option.id, label: option.label })),
  }))
}

export function listProducts(): Product[] {
  const rows = all<ProductRow>('SELECT * FROM products ORDER BY name COLLATE NOCASE')
  return rows.map((row) => mapProduct(row, listVariations(row.id)))
}

export function getProduct(id: string): Product | null {
  const row = get<ProductRow>('SELECT * FROM products WHERE id = ?', [id])
  return row ? mapProduct(row, listVariations(row.id)) : null
}

export interface ProductInput {
  name: string
  description: string | null
  photo: string | null
  priceMode: Product['priceMode']
  price: number | null
}

export function createProduct(input: ProductInput): string {
  const id = uid()
  run(
    'INSERT INTO products (id, name, description, photo, price_mode, price) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.name, input.description, input.photo, input.priceMode, input.price],
  )
  return id
}

export function updateProduct(id: string, input: ProductInput): void {
  run(
    'UPDATE products SET name = ?, description = ?, photo = ?, price_mode = ?, price = ? WHERE id = ?',
    [input.name, input.description, input.photo, input.priceMode, input.price, id],
  )
  // Changing the price mode invalidates per-SKU prices when switching to global.
  if (input.priceMode === 'global') {
    run('UPDATE skus SET price = NULL WHERE product_id = ?', [id])
  }
}

/** True when the product is referenced by any sale or inventory item. */
export function productInUse(id: string): boolean {
  const saleRef = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sale_items si
     JOIN skus s ON s.id = si.sku_id WHERE s.product_id = ?`,
    [id],
  )
  const inventoryRef = get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM inventory_items WHERE sku_id IN (SELECT id FROM skus WHERE product_id = ?)',
    [id],
  )
  return (saleRef?.n ?? 0) > 0 || (inventoryRef?.n ?? 0) > 0
}

export function deleteProduct(id: string): void {
  run('DELETE FROM products WHERE id = ?', [id])
}

// ── Variations / options ─────────────────────────────────────────────────

export function addVariation(productId: string, name: string): string {
  const id = uid()
  transaction(() => {
    run(
      'INSERT INTO variations (id, product_id, name, position) VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM variations WHERE product_id = ?))',
      [id, productId, name, productId],
    )
    recomputeSkus(productId)
  })
  return id
}

export function removeVariation(variationId: string): void {
  const variation = get<VariationRow>('SELECT * FROM variations WHERE id = ?', [variationId])
  if (!variation) return
  transaction(() => {
    run('DELETE FROM variation_options WHERE variation_id = ?', [variationId])
    run('DELETE FROM variations WHERE id = ?', [variationId])
    recomputeSkus(variation.product_id)
  })
}

export function addOption(variationId: string, label: string): string {
  const id = uid()
  const variation = get<VariationRow>('SELECT * FROM variations WHERE id = ?', [variationId])
  if (!variation) throw new Error('Variation not found')
  transaction(() => {
    run(
      'INSERT INTO variation_options (id, variation_id, label, position) VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM variation_options WHERE variation_id = ?))',
      [id, variationId, label, variationId],
    )
    recomputeSkus(variation.product_id)
  })
  return id
}

export function removeOption(optionId: string): void {
  const option = get<{ id: string; variation_id: string }>(
    'SELECT id, variation_id FROM variation_options WHERE id = ?',
    [optionId],
  )
  if (!option) return
  const variation = get<VariationRow>('SELECT * FROM variations WHERE id = ?', [
    option.variation_id,
  ])
  transaction(() => {
    run('DELETE FROM variation_options WHERE id = ?', [optionId])
    if (variation) recomputeSkus(variation.product_id)
  })
}

// ── SKUs ─────────────────────────────────────────────────────────────────

function mapSku(row: SkuRow): Sku {
  return {
    id: row.id,
    productId: row.product_id,
    optionIds: JSON.parse(row.option_ids) as string[],
    price: row.price,
  }
}

export function listSkus(productId?: string): Sku[] {
  const rows = productId
    ? all<SkuRow>('SELECT * FROM skus WHERE product_id = ?', [productId])
    : all<SkuRow>('SELECT * FROM skus')
  return rows.map(mapSku)
}

export function getSku(id: string): Sku | null {
  const row = get<SkuRow>('SELECT * FROM skus WHERE id = ?', [id])
  return row ? mapSku(row) : null
}

/**
 * Keep the skus table in sync with the cartesian product of variation
 * options: insert missing combinations, drop orphaned ones. Existing
 * prices survive because rows are keyed by their option-id set.
 */
function recomputeSkus(productId: string): void {
  const product = getProduct(productId)
  if (!product) return
  const existing = listSkus(productId)
  const desired: string[][] = product.variations.reduce<string[][]>(
    (combinations, variation) =>
      variation.options.length === 0
        ? combinations
        : combinations.flatMap((combo) => variation.options.map((option) => [...combo, option.id])),
    [[]],
  )
  if (desired.length === 1 && desired[0]?.length === 0) {
    desired.length = 0
  }
  const desiredKeys = new Set(desired.map((combo) => JSON.stringify([...combo].sort())))
  for (const combo of desired) {
    const key = JSON.stringify([...combo].sort())
    if (!existing.some((sku) => JSON.stringify([...sku.optionIds].sort()) === key)) {
      run('INSERT INTO skus (id, product_id, option_ids, price) VALUES (?, ?, ?, NULL)', [
        uid(),
        productId,
        key,
      ])
    }
  }
  for (const sku of existing) {
    if (!desiredKeys.has(JSON.stringify([...sku.optionIds].sort()))) {
      run('DELETE FROM skus WHERE id = ?', [sku.id])
    }
  }
}

export function setSkuPrice(skuId: string, price: number | null): void {
  run('UPDATE skus SET price = ? WHERE id = ?', [price, skuId])
}

/** All SKUs joined with product name, label and effective price. */
export function listSkusWithProducts(): SkuWithProduct[] {
  const products = new Map(listProducts().map((product) => [product.id, product]))
  return listSkus()
    .map((sku) => {
      const product = products.get(sku.productId)
      if (!product) return null
      const price = product.priceMode === 'global' ? product.price : sku.price
      return { ...sku, productName: product.name, label: skuLabel(product, sku), price }
    })
    .filter((sku): sku is SkuWithProduct => sku !== null)
    .sort((a, b) => `${a.productName} ${a.label}`.localeCompare(`${b.productName} ${b.label}`))
}
