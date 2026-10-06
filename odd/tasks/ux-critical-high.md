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
- [x] T4 UX-03 Combobox keyboard support: active option, aria-activedescendant/aria-controls, Arrow/Enter/Escape.
- [x] T5 UX-04/05/07 Contrast + focus visibility: badge colors >= 4.5:1, input borders and focus ring >= 3:1, delivered toggle focus-visible.
- [x] T6 UX-06 Label every unlabeled control.

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
  Commit `2dc9d09`.
- T4 (RED observed: 5/6 Combobox tests failed against the old component). `Combobox.vue` follows the ARIA 1.2
  combobox pattern: `aria-controls` → listbox id (listbox kept in the DOM with `v-show`), `aria-activedescendant`,
  options are `div[role=option]` with ids, `aria-selected`, `aria-disabled`; ArrowUp/Down move the active row
  (skipping disabled, including the "Create" row), Enter picks it and stops propagation (so SaleForm's
  "Enter adds a line" needs a second Enter), Escape closes the list and marks the event handled only while open
  (so the dialog ignores it). Options keep focus in the input (`mousedown.prevent`); Teleport kept. Home/End not
  added (caret keys in a text input). Checks: `bun run test:unit --run` 86/86 pass; `bun run type-check` pass;
  `bun run lint` pass. Commit `eed741c`.
- T5 (RED observed: 12/16 token contrast tests failed before the token change). New tokens in `main.css`
  (light / dark): `--color-primary-ink` #9c4719 / #e8803f, `--color-success-ink` #33693f / #84c491,
  `--color-warning-ink` #7a5300 / #e2a93b, `--color-control-border` #8e7f70 / #8a7866; `--color-focus-ring`
  #f6e4d7 → #b3541e / 50% #d96f35 → #d96f35, with `outline-offset: 2px`. Badges, combobox active/selected rows and
  menu-item hover use the ink tokens; inputs/selects/textareas and the delivered toggle off-track use
  `--color-control-border`; `.delivered-input:focus-visible + .track` outline added.
  Ratios before → after (light): info 4.04 → 5.11, neutral 3.83 → 5.85, success 4.34 → 5.47, danger 4.69 (kept);
  control border 1.32 → 3.87 on surface, 1.23 → 3.60 on bg; focus ring 1.24 → 5.00 on surface, 4.64 on bg;
  toggle track 1.32 → 3.87. (dark): info 4.06 → 4.91, warning 6.73, success 6.53, danger 5.15 (kept);
  control border 1.38 → 3.73 on surface, 1.59 → 4.30 on bg; focus ring ≈2.2 (50% alpha) → 4.72 surface / 5.44 bg.
  Guarded by `src/shared/assets/__tests__/contrast.spec.ts`. Checks: `bun run test:unit --run` 102/102 pass;
  `bun run type-check` pass; `bun run lint` pass. Commit `3e8c045`.
- T6 (no meaningful RED: markup-only names; covered by the InventoryEditor component test and e2e `getByLabel`).
  `aria-label`s: tanda name/date (TandaHeader inline header), produced quantity "Produced — <product (option)>"
  (InventoryEditor, table and mobile list), "Price for <combo>" (PriceTable), "New option for <variation>" /
  "New variation name" (VariationEditor). Photo uses `<label for="product-photo">`; Settings "Data" is a
  `role="group"` labelled by its heading, the hidden import input gets a name and `tabindex="-1"`.
  E2E switched to `getByLabel` for price, produced, tanda name/date, new variation/option inputs.
  Checks: `bun run test:unit --run` 102/102 pass; `bun run type-check` pass; `bun run lint` pass;
  `bun run build-only` pass; `CI=1 bunx playwright test --retries=0 --project=chromium --project=firefox` 8/8 pass.

## Next step
Feature complete. Push / PR are the user's decision.
