import { all, get, run, transaction, uid, nowIso } from '../database'
import { getProduct, getSku, listSkus, resolvePrice } from './products'
import { getClient } from './clients'
import { fromCents, toCents } from '../money'
import {
  canDeliver,
  canEditInventory,
  canSell,
  canTransition,
  tracksInventory,
} from '../../domain/tanda'
import type {
  InventoryEntry,
  SaleLine,
  SaleWithDetails,
  Tanda,
  TandaStatus,
  TandaSummary,
  TandaType,
} from '../types'
import { skuLabel } from '../types'

interface TandaRow {
  id: string
  name: string
  date: string
  type: TandaType
  status: TandaStatus
  created_at: string
}

function mapTanda(row: TandaRow): Tanda {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function listTandas(): TandaSummary[] {
  return all<TandaRow & { sale_count: number; revenue: number; pending: number }>(
    `SELECT t.*,
            COALESCE(s.sale_count, 0) AS sale_count,
            COALESCE(s.revenue, 0) AS revenue,
            COALESCE(s.pending, 0) AS pending
     FROM tandas t
     LEFT JOIN (
       SELECT s.tanda_id,
              COUNT(*) AS sale_count,
              SUM(s.totals) AS revenue,
              SUM(s.totals - COALESCE(p.paid, 0)) AS pending
       FROM (
         SELECT s.id, s.tanda_id, SUM(si.quantity * si.unit_price) AS totals
         FROM sales s
         JOIN sale_items si ON si.sale_id = s.id
         GROUP BY s.id
       ) s
       LEFT JOIN (
         SELECT sale_id, SUM(amount) AS paid
         FROM payments
         WHERE sale_id IS NOT NULL
         GROUP BY sale_id
       ) p ON p.sale_id = s.id
       GROUP BY s.tanda_id
     ) s ON s.tanda_id = t.id
     ORDER BY t.date DESC, t.created_at DESC`,
  ).map((row) => ({
    ...mapTanda(row),
    saleCount: row.sale_count,
    revenue: fromCents(row.revenue),
    pendingBalance: fromCents(row.pending),
  }))
}

export function getTanda(id: string): Tanda | null {
  const row = get<TandaRow>('SELECT * FROM tandas WHERE id = ?', [id])
  return row ? mapTanda(row) : null
}

export interface TandaInput {
  name: string
  date: string
  type: TandaType
}

export function createTanda(input: TandaInput): string {
  const id = uid()
  run('INSERT INTO tandas (id, name, date, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    input.name,
    input.date,
    input.type,
    'open',
    nowIso(),
  ])
  return id
}

export function updateTanda(
  id: string,
  patch: Partial<Pick<Tanda, 'name' | 'date' | 'type'>>,
): void {
  const current = getTanda(id)
  if (!current) return
  run('UPDATE tandas SET name = ?, date = ?, type = ? WHERE id = ?', [
    patch.name ?? current.name,
    patch.date ?? current.date,
    patch.type ?? current.type,
    id,
  ])
}

/** Outcome of a guarded write: either applied, or refused with a user-facing reason. */
export type RepoResult = { ok: true } | { ok: false; error: string }

const SALES_CLOSED = 'Sales are closed for this tanda'

export function setTandaStatus(id: string, status: TandaStatus): RepoResult {
  const tanda = getTanda(id)
  if (!tanda) return { ok: false, error: 'Tanda not found' }
  if (!canTransition(tanda.status, status)) {
    return { ok: false, error: `Cannot move a tanda from ${tanda.status} to ${status}` }
  }
  run('UPDATE tandas SET status = ? WHERE id = ?', [status, id])
  return { ok: true }
}

// ── Inventory (anticipated tandas) ───────────────────────────────────────

export function listInventory(tandaId: string): InventoryEntry[] {
  const skus = new Map(listSkus().map((sku) => [sku.id, sku]))
  const soldBySku = new Map(
    all<{ sku_id: string; n: number }>(
      `SELECT si.sku_id, SUM(si.quantity) AS n
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.tanda_id = ?
       GROUP BY si.sku_id`,
      [tandaId],
    ).map((row) => [row.sku_id, row.n]),
  )
  const rows = all<{ id: string; sku_id: string; quantity: number }>(
    'SELECT * FROM inventory_items WHERE tanda_id = ?',
    [tandaId],
  )
  return rows.flatMap((row): InventoryEntry[] => {
    const sku = skus.get(row.sku_id)
    if (!sku) return []
    const product = getProduct(sku.productId)
    if (!product) return []
    const sold = soldBySku.get(row.sku_id) ?? 0
    return [
      {
        sku,
        productName: product.name,
        label: skuLabel(product, sku),
        produced: row.quantity,
        sold,
        available: row.quantity - sold,
      },
    ]
  })
}

export function setInventoryQuantity(tandaId: string, skuId: string, quantity: number): RepoResult {
  const tanda = getTanda(tandaId)
  if (!tanda) return { ok: false, error: 'Tanda not found' }
  if (!canEditInventory(tanda)) {
    return { ok: false, error: 'Inventory can only be edited while the tanda is open' }
  }
  const existing = get<{ id: string }>(
    'SELECT id FROM inventory_items WHERE tanda_id = ? AND sku_id = ?',
    [tandaId, skuId],
  )
  if (quantity <= 0) {
    if (existing)
      run('DELETE FROM inventory_items WHERE tanda_id = ? AND sku_id = ?', [tandaId, skuId])
    return { ok: true }
  }
  if (existing) {
    run('UPDATE inventory_items SET quantity = ? WHERE tanda_id = ? AND sku_id = ?', [
      quantity,
      tandaId,
      skuId,
    ])
  } else {
    run('INSERT INTO inventory_items (id, tanda_id, sku_id, quantity) VALUES (?, ?, ?, ?)', [
      uid(),
      tandaId,
      skuId,
      quantity,
    ])
  }
  return { ok: true }
}

// ── Sales ────────────────────────────────────────────────────────────────

function buildSaleDetails(sale: {
  id: string
  tanda_id: string
  client_id: string
  delivered: number
  created_at: string
}): SaleWithDetails | null {
  const client = getClient(sale.client_id)
  if (!client) return null
  const itemRows = all<{ id: string; sku_id: string; quantity: number; unit_price: number }>(
    'SELECT * FROM sale_items WHERE sale_id = ?',
    [sale.id],
  )
  const items: SaleLine[] = itemRows.flatMap((row): SaleLine[] => {
    const sku = getSku(row.sku_id)
    const product = sku ? getProduct(sku.productId) : null
    const label = sku && product ? `${product.name} (${skuLabel(product, sku)})` : 'Removed SKU'
    return [
      {
        skuId: row.sku_id,
        label,
        quantity: row.quantity,
        unitPrice: fromCents(row.unit_price),
        lineTotal: fromCents(row.quantity * row.unit_price),
      },
    ]
  })
  // Sum in cents, convert once: exact totals regardless of float rounding.
  const totalCents = itemRows.reduce((sum, row) => sum + row.quantity * row.unit_price, 0)
  const paidCents =
    get<{ n: number }>('SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE sale_id = ?', [
      sale.id,
    ])?.n ?? 0
  return {
    id: sale.id,
    tandaId: sale.tanda_id,
    clientId: sale.client_id,
    delivered: sale.delivered === 1,
    createdAt: sale.created_at,
    client,
    items,
    total: fromCents(totalCents),
    paid: fromCents(paidCents),
    balance: fromCents(totalCents - paidCents),
  }
}

export function listSales(tandaId: string): SaleWithDetails[] {
  const rows = all<{
    id: string
    tanda_id: string
    client_id: string
    delivered: number
    created_at: string
  }>('SELECT * FROM sales WHERE tanda_id = ? ORDER BY created_at DESC', [tandaId])
  return rows.flatMap((row) => {
    const sale = buildSaleDetails(row)
    return sale ? [sale] : []
  })
}

export function listSalesForClient(clientId: string): SaleWithDetails[] {
  const rows = all<{
    id: string
    tanda_id: string
    client_id: string
    delivered: number
    created_at: string
  }>('SELECT * FROM sales WHERE client_id = ? ORDER BY created_at DESC', [clientId])
  return rows.flatMap((row) => {
    const sale = buildSaleDetails(row)
    return sale ? [sale] : []
  })
}

export interface SaleItemInput {
  skuId: string
  quantity: number
}

export type CreateSaleResult = { ok: true; saleId: string } | { ok: false; error: string }

interface PricedItem {
  skuId: string
  quantity: number
  /** Snapshot unit price in integer cents (storage unit). */
  unitPriceCents: number
}

type PricingResult = { ok: true; items: PricedItem[] } | { ok: false; error: string }

/**
 * Resolve unit prices and check stock for a sale's lines (shared by create
 * and edit). `keepPrices` (cents) pins the snapshot price of lines the sale already
 * had, so an edit never reprices them; `ownQuantities` gives the sale's own
 * units back before the stock check, so keeping or shrinking lines never
 * fails against itself.
 */
function priceSaleItems(
  tanda: Pick<Tanda, 'id' | 'type'>,
  items: SaleItemInput[],
  options: { keepPrices?: Map<string, number>; ownQuantities?: Map<string, number> } = {},
): PricingResult {
  if (items.length === 0) return { ok: false, error: 'Add at least one product' }

  // Resolve prices first; refuse the whole sale if anything is unpriced.
  const priced: PricedItem[] = []
  for (const item of items) {
    const sku = getSku(item.skuId)
    const product = sku ? getProduct(sku.productId) : null
    if (!sku || !product) return { ok: false, error: 'Unknown product' }
    let unitPriceCents = options.keepPrices?.get(item.skuId)
    if (unitPriceCents === undefined) {
      const price = resolvePrice(product, sku)
      if (price === null) return { ok: false, error: `"${product.name}" has no price set` }
      unitPriceCents = toCents(price)
    }
    priced.push({ skuId: sku.id, quantity: item.quantity, unitPriceCents })
  }

  // Anticipated tandas cannot sell more than what was produced.
  if (tracksInventory(tanda)) {
    const available = new Map(
      listInventory(tanda.id).map((entry) => [entry.sku.id, entry.available]),
    )
    for (const [skuId, quantity] of options.ownQuantities ?? []) {
      available.set(skuId, (available.get(skuId) ?? 0) + quantity)
    }
    for (const item of priced) {
      const remaining = available.get(item.skuId)
      if (remaining === undefined || remaining < item.quantity) {
        return { ok: false, error: `Not enough stock for ${item.quantity}× item` }
      }
      available.set(item.skuId, remaining - item.quantity)
    }
  }

  return { ok: true, items: priced }
}

function insertSaleItems(saleId: string, items: PricedItem[]): void {
  for (const item of items) {
    run(
      'INSERT INTO sale_items (id, sale_id, sku_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
      [uid(), saleId, item.skuId, item.quantity, item.unitPriceCents],
    )
  }
}

export function createSale(input: {
  tandaId: string
  clientId: string
  items: SaleItemInput[]
}): CreateSaleResult {
  const tanda = getTanda(input.tandaId)
  if (!tanda) return { ok: false, error: 'Tanda not found' }
  if (!canSell(tanda)) return { ok: false, error: SALES_CLOSED }
  if (!getClient(input.clientId)) return { ok: false, error: 'Client not found' }

  const priced = priceSaleItems(tanda, input.items)
  if (!priced.ok) return priced

  const saleId = uid()
  transaction(() => {
    run(
      'INSERT INTO sales (id, tanda_id, client_id, delivered, created_at) VALUES (?, ?, ?, 0, ?)',
      [saleId, input.tandaId, input.clientId, nowIso()],
    )
    insertSaleItems(saleId, priced.items)
  })
  return { ok: true, saleId }
}

/**
 * Replaces the items of an existing sale. Unit prices already on the sale are
 * kept (an edit must not reprice old lines); newly added SKUs resolve the
 * current price. Payments are untouched — the balance is derived on read.
 */
export function updateSale(saleId: string, items: SaleItemInput[]): CreateSaleResult {
  const sale = get<{ tanda_id: string; type: TandaType; status: TandaStatus }>(
    'SELECT s.tanda_id, t.type, t.status FROM sales s JOIN tandas t ON t.id = s.tanda_id WHERE s.id = ?',
    [saleId],
  )
  if (!sale) return { ok: false, error: 'Sale not found' }
  if (!canSell(sale)) return { ok: false, error: SALES_CLOSED }

  const previousItems = all<{ sku_id: string; quantity: number; unit_price: number }>(
    'SELECT sku_id, quantity, unit_price FROM sale_items WHERE sale_id = ?',
    [saleId],
  )
  const keepPrices = new Map(previousItems.map((row) => [row.sku_id, row.unit_price]))
  const ownQuantities = new Map<string, number>()
  for (const row of previousItems) {
    ownQuantities.set(row.sku_id, (ownQuantities.get(row.sku_id) ?? 0) + row.quantity)
  }

  const priced = priceSaleItems({ id: sale.tanda_id, type: sale.type }, items, {
    keepPrices,
    ownQuantities,
  })
  if (!priced.ok) return priced

  transaction(() => {
    run('DELETE FROM sale_items WHERE sale_id = ?', [saleId])
    insertSaleItems(saleId, priced.items)
  })
  return { ok: true, saleId }
}

export function setDelivered(saleId: string, delivered: boolean): RepoResult {
  const sale = get<{ type: TandaType; status: TandaStatus }>(
    'SELECT t.type, t.status FROM sales s JOIN tandas t ON t.id = s.tanda_id WHERE s.id = ?',
    [saleId],
  )
  if (!sale) return { ok: false, error: 'Sale not found' }
  if (!canDeliver(sale)) {
    return { ok: false, error: 'Delivery can only be marked once the tanda is ready' }
  }
  run('UPDATE sales SET delivered = ? WHERE id = ?', [delivered ? 1 : 0, saleId])
  return { ok: true }
}

/** Deletes a sale; payments tied to it become general client payments. */
export function deleteSale(saleId: string): void {
  transaction(() => {
    run('UPDATE payments SET sale_id = NULL WHERE sale_id = ?', [saleId])
    run('DELETE FROM sales WHERE id = ?', [saleId])
  })
}
