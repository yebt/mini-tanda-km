import { shallowRef } from 'vue'
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

import { idbGet, idbSet } from './idb'

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
  photo TEXT,
  price_mode TEXT NOT NULL DEFAULT 'global' CHECK (price_mode IN ('global', 'per_sku')),
  price REAL,
  -- JSON array of variation ids that drive pricing (per_sku mode). Empty/NULL
  -- means the pricing variation subset has not been chosen yet.
  price_variation_ids TEXT
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
  price REAL
);

-- Price rows keyed by a combination of options from the product's
-- pricing variations (a subset of all variations).
CREATE TABLE IF NOT EXISTS sku_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_ids TEXT NOT NULL,
  price REAL NOT NULL
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
  unit_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sale_id TEXT,
  amount REAL NOT NULL,
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

/**
 * Idempotent, data-preserving migrations, tracked with PRAGMA user_version.
 * v0 → v1: per-SKU prices move from skus.price to sku_prices so pricing can
 * depend on a subset of variations.
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

/**
 * Replace ALL app data with an exported payload (`{ app, exportedAt, data }`
 * or the bare `data` map). Children are deleted before parents to respect
 * foreign keys. Only columns that exist in each table are imported; unknown
 * keys are ignored so they never reach the SQL text. Returns the number of
 * rows inserted.
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
    'products',
    'clients',
    'settings',
  ] as const

  let inserted = 0
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
        const columns = Object.keys(record).filter((column) => knownColumns.has(column))
        if (columns.length === 0) continue
        const placeholders = columns.map(() => '?').join(', ')
        run(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          columns.map((c) => record[c] ?? null),
        )
        inserted++
      }
    }
  })
  return inserted
}
