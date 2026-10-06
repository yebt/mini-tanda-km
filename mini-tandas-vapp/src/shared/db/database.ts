import { shallowRef } from 'vue'
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

import { idbGet, idbSet } from './idb'
import { toCents } from './money'

const DB_KEY = 'database'
const PERSIST_DELAY_MS = 400

let db: Database | null = null
let persistQueued = false

/**
 * Bumped on every write. Components/stores read it inside `computed`
 * so queries re-run after mutations, keeping sql.js state reactive.
 */
export const dbVersion = shallowRef(0)

function touch(): void {
  dbVersion.value++
  persistQueued = true
  schedulePersist()
}

let persistTimer: ReturnType<typeof setTimeout> | undefined
function schedulePersist(): void {
  if (persistTimer !== undefined) return
  persistTimer = setTimeout(() => {
    persistTimer = undefined
    void persistNow()
  }, PERSIST_DELAY_MS)
}

async function persistNow(): Promise<void> {
  if (!db || !persistQueued) return
  persistQueued = false
  // Tests run in Node, where indexedDB does not exist; persistence is a
  // browser-only concern, so skip silently instead of rejecting.
  if (typeof indexedDB === 'undefined') return
  await idbSet(DB_KEY, db.export())
}

/** Write pending changes now, cancelling the debounced save. */
export function flushPersistence(): Promise<void> {
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer)
    persistTimer = undefined
  }
  return persistNow()
}

/**
 * Flush pending changes whenever the page may be going away: hidden tab
 * (mobile browsers often kill backgrounded pages without `beforeunload`),
 * `pagehide` (bfcache / navigation) and `beforeunload`. Returns a cleanup
 * function; a no-op outside the browser.
 */
export function registerPersistenceFlush(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const flush = () => void flushPersistence()
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', flush)
    window.removeEventListener('beforeunload', flush)
  }
}

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  -- Small preview image (data URL, ~160px) shown by lists. The full photo
  -- lives in product_photos and is read only by the product editor (v4+).
  thumbnail TEXT,
  price_mode TEXT NOT NULL DEFAULT 'global' CHECK (price_mode IN ('global', 'per_sku')),
  -- Money columns hold integer cents (schema v2+).
  price INTEGER,
  -- JSON array of variation ids that drive pricing (per_sku mode). Empty/NULL
  -- means the pricing variation subset has not been chosen yet.
  price_variation_ids TEXT
);

-- Full-size product photo (data URL), kept out of the products row so list
-- queries never copy it out of SQLite.
CREATE TABLE IF NOT EXISTS product_photos (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS variations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS variation_options (
  id TEXT PRIMARY KEY,
  variation_id TEXT NOT NULL REFERENCES variations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

-- SKU = one combination of variation options. Referenced loosely
-- (no FK) from inventory/sale items so SKUs can be removed later.
-- The price column is legacy (pre-v1); per-SKU prices live in sku_prices
-- so that pricing can depend on any SUBSET of variations (e.g. SIZE only).
CREATE TABLE IF NOT EXISTS skus (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_ids TEXT NOT NULL,
  price INTEGER
);

-- Price rows keyed by a combination of options from the product's
-- pricing variations (a subset of all variations).
CREATE TABLE IF NOT EXISTS sku_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_ids TEXT NOT NULL,
  price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tandas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scheduled', 'anticipated')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'production', 'ready', 'closed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  tanda_id TEXT NOT NULL REFERENCES tandas(id) ON DELETE CASCADE,
  sku_id TEXT NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  tanda_id TEXT NOT NULL REFERENCES tandas(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sku_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sale_id TEXT,
  amount INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variations_product ON variations(product_id);
CREATE INDEX IF NOT EXISTS idx_options_variation ON variation_options(variation_id);
CREATE INDEX IF NOT EXISTS idx_skus_product ON skus(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tanda ON inventory_items(tanda_id);
CREATE INDEX IF NOT EXISTS idx_sales_tanda ON sales(tanda_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
`

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const saved = await idbGet(DB_KEY)
  const instance = saved ? new SQL.Database(saved) : new SQL.Database()
  openWithInstance(instance)
  if (!saved) {
    persistQueued = true
    await persistNow()
  }
  registerPersistenceFlush()
}

/** Adopt an existing Database instance (used by tests with an in-memory DB). */
export function openWithInstance(instance: Database): void {
  db = instance
  db.run(SCHEMA)
  migrate()
}

/** Current schema version (PRAGMA user_version). */
export const SCHEMA_VERSION = 4

/** Columns holding money, stored as integer cents since schema v2. */
const MONEY_COLUMNS: Record<string, string[]> = {
  products: ['price'],
  skus: ['price'],
  sku_prices: ['price'],
  sale_items: ['unit_price'],
  payments: ['amount'],
}

/**
 * Idempotent, data-preserving migrations, tracked with PRAGMA user_version.
 * v0 → v1: per-SKU prices move from skus.price to sku_prices so pricing can
 * depend on a subset of variations.
 * v1 → v2: money columns move from REAL currency units to integer cents.
 * v2 → v3: products without variation options get their single default SKU.
 * v3 → v4: full photos move from products.photo to product_photos; products
 *          gain a thumbnail column (filled asynchronously in the browser).
 */
function migrate(): void {
  const d = requireDb()
  const version = get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0
  if (version < 1) {
    const columns = all<{ name: string }>('PRAGMA table_info(products)')
    if (!columns.some((column) => column.name === 'price_variation_ids')) {
      d.run('ALTER TABLE products ADD COLUMN price_variation_ids TEXT')
    }
    d.run(`INSERT INTO sku_prices (id, product_id, option_ids, price)
           SELECT id, product_id, option_ids, price FROM skus WHERE price IS NOT NULL`)
    d.run('UPDATE skus SET price = NULL')
    d.run('PRAGMA user_version = 1')
  }
  if (version < 2) {
    d.run('BEGIN')
    try {
      for (const [table, columns] of Object.entries(MONEY_COLUMNS)) {
        for (const column of columns) {
          const rows = all<{ id: string; value: number }>(
            `SELECT id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL`,
          )
          for (const row of rows) {
            d.run(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [toCents(row.value), row.id])
          }
        }
      }
      d.run('PRAGMA user_version = 2')
      d.run('COMMIT')
    } catch (error) {
      d.run('ROLLBACK')
      throw error
    }
  }
  if (version < 3) {
    d.run('BEGIN')
    try {
      ensureDefaultSkus()
      d.run('PRAGMA user_version = 3')
      d.run('COMMIT')
    } catch (error) {
      d.run('ROLLBACK')
      throw error
    }
  }
  if (version < 4) {
    d.run('BEGIN')
    try {
      const columns = all<{ name: string }>('PRAGMA table_info(products)').map((c) => c.name)
      if (!columns.includes('thumbnail')) d.run('ALTER TABLE products ADD COLUMN thumbnail TEXT')
      if (columns.includes('photo')) {
        d.run(`INSERT OR REPLACE INTO product_photos (product_id, data)
               SELECT id, photo FROM products WHERE photo IS NOT NULL AND photo <> ''`)
        d.run('ALTER TABLE products DROP COLUMN photo')
      }
      d.run('PRAGMA user_version = 4')
      d.run('COMMIT')
    } catch (error) {
      d.run('ROLLBACK')
      throw error
    }
  }
}

/**
 * A product whose variations have no options (or that has none at all) is
 * sold as one SKU with an empty option set. Older app versions never created
 * it; insert it for every such product that has no SKU yet. Idempotent.
 */
function ensureDefaultSkus(): void {
  const d = requireDb()
  const missing = all<{ id: string }>(
    `SELECT p.id FROM products p
     WHERE NOT EXISTS (SELECT 1 FROM skus s WHERE s.product_id = p.id)
       AND NOT EXISTS (
         SELECT 1 FROM variations v
         JOIN variation_options o ON o.variation_id = v.id
         WHERE v.product_id = p.id
       )`,
  )
  for (const product of missing) {
    d.run("INSERT INTO skus (id, product_id, option_ids, price) VALUES (?, ?, '[]', NULL)", [
      uid(),
      product.id,
    ])
  }
}

export function uid(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function requireDb(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function all<T>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = requireDb().prepare(sql)
  try {
    stmt.bind(params)
    const rows: T[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T)
    }
    return rows
  } finally {
    stmt.free()
  }
}

export function get<T>(sql: string, params: SqlValue[] = []): T | null {
  return all<T>(sql, params)[0] ?? null
}

/** Run a write statement and bump the reactive version. */
export function run(sql: string, params: SqlValue[] = []): void {
  requireDb().run(sql, params)
  touch()
}

/** Run multiple statements as one transaction; bumps the version once. */
export function transaction(fn: () => void): void {
  const d = requireDb()
  d.run('BEGIN')
  try {
    fn()
    d.run('COMMIT')
    touch()
  } catch (error) {
    d.run('ROLLBACK')
    throw error
  }
}

const EXPORT_TABLES = [
  'products',
  'product_photos',
  'variations',
  'variation_options',
  'skus',
  'sku_prices',
  'settings',
  'clients',
  'tandas',
  'inventory_items',
  'sales',
  'sale_items',
  'payments',
] as const

/** Full app data as plain JSON rows, keyed by table (for backups/exports). */
export function exportAllData(): Record<string, Record<string, SqlValue>[]> {
  return Object.fromEntries(EXPORT_TABLES.map((table) => [table, all(`SELECT * FROM ${table}`)]))
}

/** Backup file contents: app marker, schema version (money unit) and data. */
export function exportPayload(): {
  app: 'mini-tanda'
  schemaVersion: number
  exportedAt: string
  data: Record<string, Record<string, SqlValue>[]>
} {
  return {
    app: 'mini-tanda',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    data: exportAllData(),
  }
}

/**
 * Replace ALL app data with an exported payload (`{ app, exportedAt, data }`
 * or the bare `data` map). Children are deleted before parents to respect
 * foreign keys. Only columns that exist in each table are imported; unknown
 * keys are ignored so they never reach the SQL text. Backups without a
 * `schemaVersion` >= 2 hold money as REAL currency units and are converted
 * to cents. Backups from before v4 keep the full photo on the product row;
 * it is moved to product_photos (its thumbnail is backfilled later).
 * Returns the number of rows inserted.
 */
export function importAllData(payload: unknown): number {
  const data =
    typeof payload === 'object' && payload !== null && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload
  if (typeof data !== 'object' || data === null) {
    throw new Error('Not a Mini Tanda export file.')
  }
  const rowsByTable = data as Record<string, unknown>
  const schemaVersion =
    typeof payload === 'object' && payload !== null && 'schemaVersion' in payload
      ? Number((payload as { schemaVersion: unknown }).schemaVersion)
      : 0
  const moneyInCents = schemaVersion >= 2
  const unknownTables = Object.keys(rowsByTable).filter(
    (t) => !(EXPORT_TABLES as readonly string[]).includes(t),
  )
  if (unknownTables.length > 0) {
    throw new Error(`Unrecognized tables in file: ${unknownTables.join(', ')}`)
  }

  // Child-before-parent deletion order (FK-safe).
  const DELETE_ORDER = [
    'payments',
    'sale_items',
    'sales',
    'inventory_items',
    'tandas',
    'sku_prices',
    'skus',
    'variation_options',
    'variations',
    'product_photos',
    'products',
    'clients',
    'settings',
  ] as const

  let inserted = 0
  /** Pre-v4 backups: photo found on a product row, keyed by product id. */
  const legacyPhotos = new Map<string, string>()
  transaction(() => {
    for (const table of DELETE_ORDER) {
      run(`DELETE FROM ${table}`)
    }
    for (const table of EXPORT_TABLES) {
      const rows = rowsByTable[table]
      if (!Array.isArray(rows)) continue
      // Only real columns of the table reach the SQL text; anything else in
      // the file (unknown or hostile keys) is ignored.
      const knownColumns = new Set(
        all<{ name: string }>(`PRAGMA table_info(${table})`).map((column) => column.name),
      )
      for (const row of rows) {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) {
          throw new Error(`Invalid row in table "${table}".`)
        }
        const record = row as Record<string, SqlValue>
        if (table === 'products' && typeof record.photo === 'string' && record.photo !== '') {
          legacyPhotos.set(String(record.id), record.photo)
        }
        const columns = Object.keys(record).filter((column) => knownColumns.has(column))
        if (columns.length === 0) continue
        const moneyColumns = moneyInCents ? [] : (MONEY_COLUMNS[table] ?? [])
        const placeholders = columns.map(() => '?').join(', ')
        run(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          columns.map((c) => {
            const value = record[c] ?? null
            return typeof value === 'number' && moneyColumns.includes(c) ? toCents(value) : value
          }),
        )
        inserted++
      }
    }
    for (const [productId, data] of legacyPhotos) {
      run('INSERT OR IGNORE INTO product_photos (product_id, data) VALUES (?, ?)', [
        productId,
        data,
      ])
    }
    // Backups from older versions lack the default SKU of simple products.
    ensureDefaultSkus()
  })
  return inserted
}
