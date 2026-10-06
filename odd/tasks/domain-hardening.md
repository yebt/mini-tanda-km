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
- [x] T1 Pure domain module for tanda rules (`canSell`, `canDeliver`, `canEditInventory`, `canTransition`), enforced in repos and reused by components, with unit tests.
- [ ] T2 Shared price+stock helper used by `createSale` and `updateSale` (remove duplication).
- [ ] T3 Harden `importAllData` (whitelist columns per table) + export/import round-trip test.
- [ ] T4 Persistence flush on `visibilitychange`/`pagehide`.
- [ ] T5 Money stored as integer cents (schema migration, formatting unchanged for the user) + tests.
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

## Next step
T2.
