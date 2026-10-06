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
- [x] T5 (63c38a5) Money stored as integer cents (schema migration, formatting unchanged for the user) + tests.
- [x] T6 (6e1ff0e) Split `SaleForm.vue` into a `useSaleDraft` composable; component/composable tests.
- [x] T7 Cleanup: move `shot-*.mjs` to `scripts/`, drop deprecated `Sku.price`, route settings export/import through a store.

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

### T6 — `useSaleDraft` composable (done)
- `src/features/tandas/composables/useSaleDraft.ts`: `useSaleDraft` (pending SKU/qty, merged lines, product options with price/stock hints, stock caps incl. own quantities on edit, running total, `addLine`/`bumpLine`/`setLineQuantity`/`removeLine`/`reset`/`items`) and `useInventoryAvailability` (produced/sold/available lookups). Takes getters (type, catalog, inventory) so it is testable without Pinia; stores stay in the component.
- Domain reuse: new `tracksInventory(tanda)` in `domain/tanda.ts`, used by the composable, `canEditInventory` and the repo stock check.
- `SaleForm.vue` 614 → 484 lines (template/styles unchanged); `InventoryEditor.vue` uses `useInventoryAvailability` instead of its three maps.
- Preserved as-is (no behavior change): scheduled product hints still read `· 0 available`.
- RED observed: composable module missing; then 8 failures from a test-scope bug (shared `effectScope` stopped after first test), fixed in the test.
- Checks: `bun run test:unit --run`: 63 passed; `bun run type-check`: pass; `bun run lint`: pass.
- E2E (run early because T6 touches the sale UI): `bun run test:e2e` is unusable locally — another project's Vite dev server (`mini-tanda-cwrk`) holds port 5173 and Playwright reuses it (`reuseExistingServer`). Ran `bun run build-only && CI=1 bunx playwright test --retries=0` (preview on 4173): chromium 3/3 and firefox 3/3 passed; webkit 3/3 failed to launch (`Host system is missing dependencies to run browsers`) — environmental.

### T7 — cleanup (done)
- `shot-*.mjs` moved to `mini-tandas-vapp/scripts/` (`git mv`); they use cwd-relative output paths, so run them from the app root as before (`node scripts/shot-combo.mjs`).
- `Sku.price` removed from the type and `mapSku`; `SkuWithProduct.price` (effective price) is unchanged. The `skus.price` column stays in the schema; v0 → v1 and v1 → v2 migrations and backup import still handle it.
- `stores/settings.ts` gains `exportBackup()` / `importBackup(payload)`; the settings page no longer imports `database.ts`. `importBackup` also reloads settings, so an imported currency applies immediately (previously only after a reload).
- RED observed: 2 store tests failing (`exportBackup is not a function`).
- Checks: `bun run test:unit --run`: 65 passed; `bun run type-check`: pass; `bun run lint`: pass.
- E2E: `bun run test:e2e`: 9 failed — environmental, another project's dev server on :5173 is reused. `bun run build-only && CI=1 bunx playwright test --retries=0`: chromium 3/3 + firefox 3/3 passed; webkit 3/3 failed to launch (`Host system is missing dependencies to run browsers`).

## Next step
Feature complete. Pending human decisions: e2e on a free :5173 (or stop the other dev server) and webkit host deps; push / PR strategy (forecast > 400 lines, ask-on-risk).
