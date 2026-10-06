# Feature: domain-hardening

## Objective
Fix the problems found in the project analysis (2026-10-06) so business rules, data integrity and persistence hold independently of the UI.

## Problem
- Tanda status rules (sale window, delivery gate, inventory editing, status transitions) are enforced only in Vue components; repos accept any call.
- `importAllData` interpolates column names from the imported JSON into SQL.
- Money is stored as `REAL` floats.
- `createSale` / `updateSale` duplicate price-resolution and stock-check logic; `SaleForm.vue` is 614 lines.
- Persistence flush relies on `beforeunload` only.
- Leftovers: tracked `shot-*.mjs` scripts, deprecated `Sku.price`, settings page importing `database.ts` directly.

## Why
Rules that live only in the UI break as soon as a second caller appears (import, future cloud sync, another screen). Cloud sync is not in `docs/SPECS.md` but is a likely future phase; these fixes must not block it.

## Scope / constraints
- App: `mini-tandas-vapp/`. Behavior must match `docs/SPECS.md`; UI behavior stays the same.
- No cloud sync work. No new dependencies.
- Never commit the pre-staged root `.gitignore` (user's own pending change).
- Test-first where a deterministic unit test applies (Vitest).

## Checks
- `bun run test:unit --run`
- `bun run type-check`
- `bun run lint`
- `bun run test:e2e` (at closure)

## Delivery
Branch `fix/domain-hardening`, one Conventional Commit per task. Strategy: ask-on-risk; forecast > 400 authored lines, so chain/PR strategy is decided by the user at PR time (no push/PR authorized).

## Tasks
- [x] T1 (3e7eb97) Pure domain module for tanda rules (`canSell`, `canDeliver`, `canEditInventory`, `canTransition`), enforced in repos and reused by components, with unit tests.
- [x] T2 (05b64b7) Shared price+stock helper used by `createSale` and `updateSale` (remove duplication).
- [x] T3 (bba8581) Harden `importAllData` (whitelist columns per table) + export/import round-trip test.
- [x] T4 (33241cb) Persistence flush on `visibilitychange`/`pagehide`.
- [x] T5 Money stored as integer cents (schema migration, formatting unchanged for the user) + tests.
- [ ] T6 Split `SaleForm.vue` into a `useSaleDraft` composable; component/composable tests.
- [ ] T7 Cleanup: move `shot-*.mjs` to `scripts/`, drop deprecated `Sku.price`, route settings export/import through a store.

## Route
Delegated direct (writer trigger: 2+ non-trivial files per task). RDD: off (global) — ordinary checks only.

## Progress / evidence
### T1 — domain rules (done)
- `src/shared/domain/tanda.ts`: `canSell`, `canDeliver`, `canEditInventory`, `canTransition`, `nextStatus`, `previousStatus` (pure, type-only import of `db/types`).
- Rules mirror the UI: scheduled sells while `open`, anticipated while `ready`; delivery in `ready`/`closed`; inventory editable for anticipated tandas while `open`; status moves one step forward or back.
- Repos refuse with the existing `{ ok: false, error }` result convention (`RepoResult`); `setTandaStatus`, `setInventoryQuantity`, `setDelivered` now return it; stores pass it through.
- Decision (SPECS over UI): `updateSale` also requires `canSell` — SPECS says sales close once the tanda leaves the sale window, and an edit can add products. The sale card hides "Edit" outside the sale window (previously always shown). Moving the tanda back (allowed with confirmation) reopens editing.
- Existing repo tests updated to follow the status flow (anticipated sales after `ready`, delivery after `ready`).
- RED observed: domain module missing (suite failed) and 5 repo rejection tests failing before enforcement.
- Checks: `bun run test:unit --run`: 37 passed; `bun run type-check`: pass; `bun run lint`: pass.

### T2 — shared price/stock helper (done)
- `priceSaleItems(tanda, items, { keepPrices, ownQuantities })` + `insertSaleItems` in `repos/tandas.ts`, used by `createSale` and `updateSale`; snapshot prices and own-quantity give-back preserved.
- Refactor under existing coverage (no meaningful RED); added a characterization test for edit pricing (old line keeps snapshot, new line takes current price, unknown SKU refused).
- Checks: `bun run test:unit --run`: 38 passed; `bun run type-check`: pass; `bun run lint`: pass.

### T3 — import hardening (done)
- `importAllData` reads `PRAGMA table_info(<table>)` per table (table names come from the static `EXPORT_TABLES` list) and only inserts known columns; unknown/hostile keys are ignored. Non-object rows throw `Invalid row in table "<t>".` inside the transaction (rollback keeps current data).
- Tests (`import-export.spec.ts`): round trip export → import into an empty DB equals the export; malicious column name is ignored and `clients` survives; invalid row leaves data untouched; unknown tables still rejected.
- RED observed: malicious-column and invalid-row tests failed before the fix (round trip already passed).
- Checks: `bun run test:unit --run`: 42 passed; `bun run type-check`: pass; `bun run lint`: pass.

### T4 — persistence flush (done)
- `database.ts`: `flushPersistence()` cancels the debounce and writes pending changes; `registerPersistenceFlush()` hooks `visibilitychange` (hidden only), `pagehide` and `beforeunload`, returns a cleanup, no-op without `window`/`document`. `initDatabase` uses it instead of the inline `beforeunload` handler.
- Tests (`persistence.spec.ts`, `idb` mocked, `indexedDB` stubbed, fake timers): hidden flushes once and cancels the debounced write; visible does not flush; `pagehide`/`beforeunload` flush; nothing pending → no write.
- RED observed: 4 failing (`registerPersistenceFlush is not a function`).
- Checks: `bun run test:unit --run`: 46 passed; `bun run type-check`: pass; `bun run lint`: pass (after typing `vi.fn` per oxlint `require-mock-type-parameters`).

### T5 — money as integer cents (done)
- Boundary: the repos. DB holds integer cents; repo functions, types, stores and UI keep currency units (e.g. `89.9`). Conversion lives only in `src/shared/db/money.ts` (`toCents` rounds half away from zero after `toPrecision(15)` to drop binary noise; `fromCents`). Sums are computed in cents and converted once.
- Schema: money columns declared `INTEGER` for new DBs; migration v1 → v2 (`SCHEMA_VERSION = 2`) converts `products.price`, `skus.price`, `sku_prices.price`, `sale_items.unit_price`, `payments.amount` in JS with `toCents`, inside a transaction. Existing DBs keep their declared `REAL` affinity (values are whole numbers, exact); a table rebuild was not worth the risk.
- Backups: `exportPayload()` adds `schemaVersion`; the settings page uses it. `importAllData` converts money columns with `toCents` when `schemaVersion` is missing or < 2 (old backups).
- Tests (`money.spec.ts`): rounding, API-in-units/DB-in-cents, exact totals/balances/revenue (0.1 × 3 = 0.3), v1 → v2 migration with rounding and idempotent reopen, round trip with `schemaVersion`, old REAL backup import. T3 round-trip test now uses `exportPayload()`.
- RED observed: 5 failing before the migration/conversion (helper tests passed once `money.ts` existed).
- Checks: `bun run test:unit --run`: 53 passed; `bun run type-check`: pass; `bun run lint`: pass.

## Next step
T6.
