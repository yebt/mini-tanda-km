# Feature: perf-and-spacing

## Objective
Remove the blocking delay on first navigation to /products and make spacing uniform across views.

## Evidence (measured 2026-10-06, Playwright chromium, 10 products)
- With ~365 KB photos: first /products visit blocks the main thread 125–435 ms (one long task); one write re-queries everything for 135–206 ms (preview). Without photos: ~70–80 ms.
- Causes: `SELECT *` copies base64 photos out of sql.js on every list query (`repos/products.ts:67`); `listSkusWithProducts` calls `listProducts` again; `ProductList.vue` renders table and cards at once (each photo twice); global `dbVersion` re-runs every computed after any write; per-product variation queries (N+1).
- Measurement script: scratchpad `perf/measure.mjs` (session-local).
- Spacing: dashboard section gap 16px vs card gap 8px (`pages/index.vue:59`, `.row-wrap`), stat cards with smaller padding; spacing steps are picked ad hoc per view.

## Decisions
- Photos: full image moves to a separate `product_photos` table loaded only by the editor; lists use a small generated thumbnail column. Keeps export/import and a future cloud sync working (all data stays in SQLite).

## Scope / constraints
App `mini-tandas-vapp/`; no new dependencies; UI behavior unchanged except speed and spacing. Never commit the pre-staged root `.gitignore` or `.engram/`.

## Checks
`bun run test:unit --run`, `bun run type-check`, `bun run lint`; e2e at closure via `bun run build-only && CI=1 bunx playwright test --retries=0 --project=chromium --project=firefox`; before/after timings with the measurement script.

## Delivery
Branch `fix/perf-and-spacing` (from `fix/ux-medium-low`), one Conventional Commit per task. Push/PR decided by user.

## Route
Delegated direct (writer trigger: multi-file). RDD off (global).

## Tasks
- [x] T1 Photos out of list queries: explicit columns, `product_photos` table + thumbnail column (schema migration, async thumbnail backfill in the browser, export/import compatible).
- [x] T2 Query shape: `listSkusWithProducts` without calling `listProducts`; variations/options in batched queries.
- [x] T3 Rendering: `ProductList` renders table or cards (not both); images `loading="lazy"` `decoding="async"` with fixed size.
- [x] T4 Invalidation: per-table/domain versions instead of one global `dbVersion`.
- [x] T5 Routes: lazy `ProductForm`; idle/hover prefetch of route chunks.
- [x] T6 Spacing: layout tokens (`--gap-section`, `--gap-grid`, `--pad-card`) applied across all views.

## Progress / evidence
Baseline (2026-10-06, before T1, `perf/measure.mjs`, chromium 1280×800, 10 products × 6 SKUs, preview build):
| scenario | first /products paint | long tasks | one-write recompute (tPaint) |
|---|---|---|---|
| no photos | 177 ms | [111] | 52 ms (60) |
| photos (~365 KB each) | 291 ms | [175, 74] | 144 ms (154) |

- T1 (inline route n/a — delegated writer): schema v4 `product_photos(product_id PK, data)` + `products.thumbnail`; list/detail queries use explicit columns; editor loads the full photo via `store.photoFor`; `ProductInput.photo` undefined keeps the stored photo; thumbnails (160px WebP/JPEG via canvas) generated on pick and backfilled on idle after startup (`features/products/lib/thumbnail.ts`); old backups with `products.photo` import into `product_photos`. RED observed: `photos.spec.ts` 7/7 failing before implementation. Checks: `bun run test:unit --run` 30 files / 161 tests pass; `bun run type-check` pass; `bun run lint` pass. Commit `61129e1`.
- T2: variations/options load with 2 queries for any number of products (`loadVariations`, grouped in JS); `listSkusWithProducts(loaded?)` reuses the store's products or reads a light product projection, never `listProducts`. RED observed: `query-shape.spec.ts` query-count tests failed (28 vs 10, 30 vs 12 statements); characterization tests (ordering, SKU labels/prices) passed before and after. Checks: unit 31 files / 165 tests pass; x step
T3.
