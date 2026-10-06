# Feature: ux-critical-high

## Objective
Fix the critical and high findings (UX-01..UX-08) of `docs/UX-AUDIT.md`.

## Scope / constraints
- App `mini-tandas-vapp/`; behavior per `docs/SPECS.md`. Medium/low findings are out of scope.
- No new dependencies. Never commit the pre-staged root `.gitignore` or `.engram/`.
- Test-first where a deterministic unit test applies; a11y behavior verified with Vitest component tests and/or Playwright.

## Checks
`bun run test:unit --run`, `bun run type-check`, `bun run lint`; e2e at closure via `bun run build-only && CI=1 bunx playwright test --retries=0 --project=chromium --project=firefox` (port 5173 belongs to another project).

## Delivery
Branch `fix/ux-critical-high` (from `audit/ux`), one Conventional Commit per task. Strategy ask-on-risk; PR/push decided by user.

## Route
Delegated direct (writer trigger: multi-file). RDD off (global).

## Tasks
- [x] T1 UX-01 Products without variations get one SKU (empty option set) + migration for existing products; tests.
- [x] T2 UX-08 Inventory: unpriced SKUs cannot be stocked/sold (domain rule reused by UI and repo); tests.
- [x] T3 UX-02 Dialog a11y: focus move, focus trap, Escape, focus restore, aria-labelledby/describedby (SaleDialog, ConfirmDialogHost).
- [ ] T4 UX-03 Combobox keyboard support: active option, aria-activedescendant/aria-controls, Arrow/Enter/Escape.
- [ ] T5 UX-04/05/07 Contrast + focus visibility: badge colors >= 4.5:1, input borders and focus ring >= 3:1, delivered toggle focus-visible.
- [ ] T6 UX-06 Label every unlabeled control.

## Progress / evidence
Commit hashes are recorded in the following task's commit (a commit cannot contain its own hash).

- T1 (inline in the delegated writer; RED observed: 6/6 new tests failed in `default-sku.spec.ts` before the fix).
  `recomputeSkus` keeps the empty combination as the default SKU; `createProduct` creates it; schema v3
  migration + `importAllData` backfill (`ensureDefaultSkus`) for products saved by older versions.
  Checks: `bun run test:unit --run` 71/71 pass; `bun run type-check` pass; `bun run lint` pass.
  E2E `product without variations` added to `e2e/smoke.spec.ts` (run at closure). Commit `e4d5003`.
- T2 (RED observed: domain + repo tests failed, InventoryEditor component tests failed with the old template).
  `isSkuSellable` / `UNPRICED_SKU_REASON` in `src/shared/domain/tanda.ts`, reused by `setInventoryQuantity`
  (refuses quantity > 0 for unpriced SKUs), `InventoryEditor` (no stock input / no Sell, reason + link to Products)
  and `useSaleDraft`. Checks: `bun run test:unit --run` 75/75 pass; `bun run type-check` pass; `bun run lint` pass.
  Commit `ce77e18`.
- T3 (RED observed: 4/5 dialog tests failed against the old components). New `src/shared/ui/useDialogFocus.ts`
  (focus in on open, Tab trap, Escape for the topmost dialog only via a module stack, Escape ignored when an inner
  widget already handled it, opener remembered synchronously and refocused on close). Wired into
  `ConfirmDialogHost` (initial focus Cancel, `aria-labelledby` hidden title + `aria-describedby` message) and
  `SaleDialog` (`aria-labelledby` = SaleForm heading). Global `.visually-hidden` utility in `main.css`.
  Scroll lock unchanged. Checks: `bun run test:unit --run` 80/80 pass; `bun run type-check` pass; `bun run lint` pass.

## Next step
T4.
