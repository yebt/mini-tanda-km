import { all, get, run, transaction, uid, nowIso } from '../database'
import { getProduct, getSku, listSkus } from './products'
import { getClient } from './clients'
import type {
  InventoryEntry,
  SaleLine,
  SaleWithDetails,
  Tanda,
  TandaStatus,
  TandaSummary,
  TandaType,
} from '../types'
import { priceForSku, skuLabel } from '../types'

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
    revenue: row.revenue,
    pendingBalance: row.pending,
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

export function setTandaStatus(id: string, status: TandaStatus): void {
  run('UPDATE tandas SET status = ? WHERE id = ?', [status, id])
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

export function setInventoryQuantity(tandaId: string, skuId: string, quantity: number): void {
  const existing = get<{ id: string }>(
    'SELECT id FROM inventory_items WHERE tanda_id = ? AND sku_id = ?',
    [tandaId, skuId],
  )
  if (quantity <= 0) {
    if (existing)
      run('DELETE FROM inventory_items WHERE tanda_id = ? AND sku_id = ?', [tandaId, skuId])
    return
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
        unitPrice: row.unit_price,
        lineTotal: row.quantity * row.unit_price,
      },
    ]
  })
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const paid =
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
    total,
    paid,
    balance: total - paid,
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

export function createSale(input: {
  tandaId: string
  clientId: string
  items: SaleItemInput[]
}): CreateSaleResult {
  const tanda = getTanda(input.tandaId)
  if (!tanda) return { ok: false, error: 'Tanda not found' }
  if (!getClient(input.clientId)) return { ok: false, error: 'Client not found' }
  if (input.items.length === 0) return { ok: false, error: 'Add at least one product' }

  // Resolve prices first; refuse the whole sale if anything is unpriced.
  const priced = input.items.map((item) => {
    const sku = getSku(item.skuId)
    const product = sku ? getProduct(sku.productId) : null
    if (!sku || !product) return { error: 'Unknown product' } as const
    const price = priceForSku(product, sku)
    if (price === null) return { error: `"${product.name}" has no price set` } as const
    return { sku, quantity: item.quantity, unitPrice: price } as const
  })
  const errorItem = priced.find((item) => 'error' in item)
  if (errorItem && 'error' in errorItem) {
    return { ok: false, error: errorItem.error ?? 'Invalid item' }
  }

  // Anticipated tandas cannot sell more than what was produced.
  if (tanda.type === 'anticipated') {
    const available = new Map(
      listInventory(tanda.id).map((entry) => [entry.sku.id, entry.available]),
    )
    for (const item of priced) {
      if ('error' in item) continue
      const remaining = available.get(item.sku.id)
      if (remaining === undefined || remaining < item.quantity) {
        return { ok: false, error: `Not enough stock for ${item.quantity}× item` }
      }
      available.set(item.sku.id, remaining - item.quantity)
    }
  }

  const saleId = uid()
  transaction(() => {
    run(
      'INSERT INTO sales (id, tanda_id, client_id, delivered, created_at) VALUES (?, ?, ?, 0, ?)',
      [saleId, input.tandaId, input.clientId, nowIso()],
    )
    for (const item of priced) {
      if ('error' in item) continue
      run(
        'INSERT INTO sale_items (id, sale_id, sku_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
        [uid(), saleId, item.sku.id, item.quantity, item.unitPrice],
      )
    }
  })
  return { ok: true, saleId }
}

export function setDelivered(saleId: string, delivered: boolean): void {
  run('UPDATE sales SET delivered = ? WHERE id = ?', [delivered ? 1 : 0, saleId])
}

/** Deletes a sale; payments tied to it become general client payments. */
export function deleteSale(saleId: string): void {
  transaction(() => {
    run('UPDATE payments SET sale_id = NULL WHERE sale_id = ?', [saleId])
    run('DELETE FROM sales WHERE id = ?', [saleId])
  })
}
