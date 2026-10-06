import { all, get, run, transaction, uid } from '../database'
import { fromCents, fromCentsOrNull, toCents, toCentsOrNull } from '../money'
import type { PriceRow, Product, Sku, SkuWithProduct, Variation } from '../types'
import { skuLabel } from '../types'

interface ProductRow {
  id: string
  name: string
  description: string | null
  photo: string | null
  price_mode: Product['priceMode']
  price: number | null
  price_variation_ids: string | null
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

/** `skus.price` is a legacy (pre-v1) column, kept in the schema but no longer read. */
interface SkuRow {
  id: string
  product_id: string
  option_ids: string
}

function mapProduct(row: ProductRow, variations: Variation[]): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    photo: row.photo,
    priceMode: row.price_mode,
    price: fromCentsOrNull(row.price),
    priceVariationIds: row.price_variation_ids
      ? (JSON.parse(row.price_variation_ids) as string[])
      : [],
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
  priceVariationIds?: string[]
}

export function createProduct(input: ProductInput): string {
  const id = uid()
  transaction(() => {
    run(
      'INSERT INTO products (id, name, description, photo, price_mode, price, price_variation_ids) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        input.name,
        input.description,
        input.photo,
        input.priceMode,
        toCentsOrNull(input.price),
        JSON.stringify(input.priceVariationIds ?? []),
      ],
    )
    // A product without variations is sold as its single default SKU.
    recomputeSkus(id)
  })
  return id
}

export function updateProduct(id: string, input: ProductInput): void {
  // Preserve the pricing subset when the form does not send it.
  const priceVariationIds = input.priceVariationIds ?? getProduct(id)?.priceVariationIds ?? []
  run(
    'UPDATE products SET name = ?, description = ?, photo = ?, price_mode = ?, price = ?, price_variation_ids = ? WHERE id = ?',
    [
      input.name,
      input.description,
      input.photo,
      input.priceMode,
      toCentsOrNull(input.price),
      JSON.stringify(priceVariationIds),
      id,
    ],
  )
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
 * prices survive because rows are keyed by their option-id set. A product
 * without option-bearing variations keeps exactly one SKU with an empty
 * option set (the empty combination), priced by the product's price.
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

// ── Pricing ──────────────────────────────────────────────────────────────
//
// Prices can depend on ANY SUBSET of the variations (e.g. only SIZE, or
// SIZE + PACKAGING but not FLAVOR). The product's `priceVariationIds` picks
// that subset; `sku_prices` rows are keyed by combinations of options from
// those variations and resolve onto every SKU that contains the combination.

interface PriceRowRow {
  id: string
  product_id: string
  option_ids: string
  price: number
}

function priceKey(optionIds: string[]): string {
  return JSON.stringify([...optionIds].sort())
}

function mapPriceRow(row: PriceRowRow): PriceRow {
  return {
    id: row.id,
    productId: row.product_id,
    optionIds: JSON.parse(row.option_ids) as string[],
    price: fromCents(row.price),
  }
}

export function listPriceRows(productId?: string): PriceRow[] {
  const rows = productId
    ? all<PriceRowRow>('SELECT * FROM sku_prices WHERE product_id = ?', [productId])
    : all<PriceRowRow>('SELECT * FROM sku_prices')
  return rows.map(mapPriceRow)
}

/** Upsert a price for an option combination (0 is a valid price); `null` removes the row. */
export function setPriceRow(productId: string, optionIds: string[], price: number | null): void {
  const key = priceKey(optionIds)
  const existing = get<PriceRowRow>(
    'SELECT * FROM sku_prices WHERE product_id = ? AND option_ids = ?',
    [productId, key],
  )
  const cents = price === null ? null : toCents(price)
  if (cents === null || cents < 0) {
    if (existing) run('DELETE FROM sku_prices WHERE id = ?', [existing.id])
    return
  }
  if (existing) {
    run('UPDATE sku_prices SET price = ? WHERE id = ?', [cents, existing.id])
  } else {
    run('INSERT INTO sku_prices (id, product_id, option_ids, price) VALUES (?, ?, ?, ?)', [
      uid(),
      productId,
      key,
      cents,
    ])
  }
}

/**
 * Choose which variations drive pricing. Price rows whose options are not
 * all part of the chosen variations are dropped.
 */
export function setPricingVariations(productId: string, variationIds: string[]): void {
  const product = getProduct(productId)
  if (!product) return
  const valid = new Set(product.variations.map((variation) => variation.id))
  const chosen = variationIds.filter((id) => valid.has(id))
  transaction(() => {
    run('UPDATE products SET price_variation_ids = ? WHERE id = ?', [
      JSON.stringify(chosen),
      productId,
    ])
    const allowedOptions = new Set(
      product.variations
        .filter((variation) => chosen.includes(variation.id))
        .flatMap((variation) => variation.options.map((option) => option.id)),
    )
    for (const row of listPriceRows(productId)) {
      if (!row.optionIds.every((optionId) => allowedOptions.has(optionId))) {
        run('DELETE FROM sku_prices WHERE id = ?', [row.id])
      }
    }
  })
}

/**
 * Effective price for a SKU: the price row matching the SKU's options from
 * the pricing variations. Returns null when the product is unpriced.
 */
export function resolvePrice(
  product: Pick<Product, 'priceMode' | 'price' | 'priceVariationIds' | 'variations'>,
  sku: Pick<Sku, 'optionIds'>,
  rows?: PriceRow[],
): number | null {
  if (product.priceMode === 'global') return product.price
  if (product.priceVariationIds.length === 0) return null
  const pricingOptions = new Set(
    product.variations
      .filter((variation) => product.priceVariationIds.includes(variation.id))
      .flatMap((variation) => variation.options.map((option) => option.id)),
  )
  const key = priceKey(sku.optionIds.filter((optionId) => pricingOptions.has(optionId)))
  const row = (rows ?? listPriceRows()).find((candidate) => priceKey(candidate.optionIds) === key)
  return row?.price ?? null
}

/** All SKUs joined with product name, label and effective price. */
export function listSkusWithProducts(): SkuWithProduct[] {
  const products = new Map(listProducts().map((product) => [product.id, product]))
  const rowsByProduct = new Map<string, PriceRow[]>()
  for (const row of listPriceRows()) {
    const list = rowsByProduct.get(row.productId) ?? []
    list.push(row)
    rowsByProduct.set(row.productId, list)
  }
  return listSkus()
    .map((sku) => {
      const product = products.get(sku.productId)
      if (!product) return null
      const price = resolvePrice(product, sku, rowsByProduct.get(sku.productId) ?? [])
      return { ...sku, productName: product.name, label: skuLabel(product, sku), price }
    })
    .filter((sku): sku is SkuWithProduct => sku !== null)
    .sort((a, b) => `${a.productName} ${a.label}`.localeCompare(`${b.productName} ${b.label}`))
}
