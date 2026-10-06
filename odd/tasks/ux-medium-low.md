# Feature: ux-medium-low

## Objective
Fix the 39 medium/low findings (UX-09..UX-47) of `docs/UX-AUDIT.md`, following each finding's recommendation.

## Scope / constraints
- App `mini-tandas-vapp/`; behavior per `docs/SPECS.md`. No new dependencies.
- Never commit the pre-staged root `.gitignore` or `.engram/`.
- Where a finding needs a real product decision, apply the audit's recommendation in its least invasive form and note it under Progress.
- Test-first where a deterministic test applies (Vitest component tests / Playwright).

## Checks
`bun run test:unit --run`, `bun run type-check`, `bun run lint`; e2e at closure via `bun run build-only && CI=1 bunx playwright test --retries=0 --project=chromium --project=firefox`.

## Delivery
Branch `fix/ux-medium-low` (from `fix/ux-critical-high`), one Conventional Commit per task. Push/PR decided by user.

## Route
Delegated direct (writer trigger: multi-file). RDD off (global).

## Tasks
- [x] T1 Navigation, IA & semantics: UX-10, UX-11, UX-12, UX-16, UX-26, UX-42, UX-45
- [x] T2 Responsive, mobile & touch: UX-09, UX-13, UX-14, UX-15, UX-32, UX-33, UX-38, UX-39, UX-46
- [x] T3 Feedback, errors & forms: UX-19, UX-20, UX-21, UX-23, UX-31, UX-36, UX-37
- [x] T4 Dialogs, menus & destructive actions: UX-17, UX-18, UX-24, UX-27, UX-28, UX-43
- [x] T5 Content & consistency: UX-22, UX-25, UX-29, UX-34, UX-35, UX-40, UX-41, UX-44, UX-47
- [x] T6 Perceived performance: UX-30

## Progress / evidence

### T1 — Navigation, IA & semantics (commit 2065ae2)
- UX-10: `router.afterEach` sets "<Section> · Mini Tanda"; `usePageTitle` (shared/ui) refines detail views ("Weekend cakes · Tandas · Mini Tanda", client name).
- UX-11: dashboard `<h1>Dashboard</h1>`, stat labels are `<h2>`, values `<p>`; open tanda wraps the name input in the `<h1>` (its value names the heading).
- UX-12: "Skip to content" link → `<main id="main" tabindex="-1">`; after a path change focus moves to the view's `<h1>` (query-only changes skipped).
- UX-16: back button only on detail paths (`isDetailPath`); with no in-app history it pushes the parent list.
- UX-26: new `TabList` primitive (roving tabindex, Arrow/Home/End, `aria-controls` ↔ `tabpanel`). Tanda tabs synced to `?tab=` (router.replace); scheduled tandas render no tablist, just the "Sales" heading.
- UX-42: Sales/Inventory headings visually hidden inside their tab panels.
- UX-45: dashboard `nextActions` is a `computed`.
- Decision: product editor tabs get the ARIA pattern but are not URL-synced (the editor is not a route; adding one is beyond the finding).
- RED observed: `src/pages/__tests__/dashboard.spec.ts` 2/2 failed on the original `pages/index.vue`, passed after. `TabList.spec.ts` failed (missing module) before the component existed.
- Checks: `bun run test:unit --run` 15 files / 111 tests passed; `type-check` 0 errors; `lint` clean; e2e (chromium+firefox) 10/10 passed incl. new deep-link/tab/title test.


### T2 — Responsive, mobile & touch (commit 248d170)
- UX-09: `--nav-bottom-height` in rem (grows with text size), nav uses `min-height`, labels 0.75rem and visually hidden via a container query when they no longer fit (names kept); tanda header inputs stack full-width on mobile; status actions wrap.
- UX-13: `@media (pointer: coarse)` → 44px for buttons/inputs/selects, kebab, menu items, back button, dialog close, line steppers/remove, delivered toggle; option-chip × is ≥24px always and 44px hit area on touch (pseudo-element). Structural CSS check only (jsdom has no layout; Playwright desktop projects are fine pointers).
- UX-14: `.app-main:has(.fab)` reserves nav + FAB + 24px (e2e asserts padding ≥ FAB reach).
- UX-15: tanda `.sales-toolbar` is desktop-only; dashboard "New tanda" → `/tandas?new=1`, which opens the form and strips the query.
- UX-32: StatusFlow actions get their own wrapping full-width row on mobile.
- UX-33: "Next up" first in DOM (keeps focus order = visual order, all sizes — decision); stats are a compact 3-column row on mobile without per-card links (bottom nav covers them).
- UX-38: `<meta name="theme-color">` kept in sync by `applyTheme`; `--color-scrim` and `--shadow-hover` tokens replace hard-coded values.
- UX-39: `viewport-fit=cover`; nav, sheet and FAB add `env(safe-area-inset-bottom)`.
- UX-46: tanda name stacks above the date on mobile.
- RED observed: `useTheme.spec.ts` failed (`'#ffffff'` vs `'#2a211a'`) against the original `useTheme.ts`, passed after.
- e2e nav locators made exact (`'Products'` also matched "View products" — strict-mode failure seen once in Firefox).
- Checks: unit 16 files / 113 tests passed; type-check 0 errors; lint clean; e2e chromium+firefox 12/12 passed.


### T3 — Feedback, errors & forms (commit 7d3f2fc)
- UX-19: `useToast` + `ToastHost` (always-mounted `role="status" aria-live="polite"`, auto-dismiss 5 s / 8 s with an action). Toasts for client added/deleted, payment recorded/deleted, sale added/updated/deleted, tanda renamed/date set, product created/saved/deleted, price saved/cleared.
- Decision (UX-19 Undo): Undo is offered for recording and deleting payments only (both reversible through existing repo calls). Sale deletion moves payments to general credit and is not cleanly reversible without a new repo operation, so it relies on the confirm (strengthened in T4).
- UX-20: field errors get `id` + `aria-describedby` + `aria-invalid` and `role="alert"`; first invalid field is focused (payment amount, client name, product name/price/photo); delete failures (`actionError`/`removeError`) are `role="alert"`.
- UX-21: one rule everywhere — a price is blank (none) or a number ≥ 0. PriceTable keeps invalid text and shows an inline error; repo `setPriceRow` stores 0 (only `null`/negative remove the row).
- UX-23: disabled delivered toggle is described by a visible hint "Available once the tanda is ready".
- UX-31: "Add sale" stays enabled; submitting shows the existing inline errors.
- UX-36: placeholders follow "e.g. …" with an ellipsis; variation/option inputs get visible labels (aria-labels kept, they contain the visible text).
- UX-37: money inputs are `type="text" inputmode="decimal"` parsed by `parseMoneyInput` (symbols, grouping, comma decimals); name/note inputs get `name` + `autocomplete="off"`.
- RED observed: parseMoney (3), PriceTable (2), toast + PaymentForm (missing modules), SaleForms (2: button disabled, no hint) all failed before the change, pass after.
- Checks: unit 21 files / 125 tests passed; type-check 0 errors; lint clean; e2e chromium+firefox 12/12 (added status-region assertion; e2e locators moved from old placeholders to labels).


### T4 — Dialogs, menus & destructive actions (commit 6793513)
- UX-17: `confirmDialog(message, label, { tone: 'danger' })` renders a filled red `.btn-danger-solid` (new `--color-on-danger`/`--color-danger-hover`, contrast-tested ≥ 4.5:1 both themes); Cancel sits left, confirm right (space-between). Used for every delete/remove, discard and import.
- Decision (UX-17 Import): instead of a typed confirmation, import snapshots the current data first and offers Undo in the toast (restores the snapshot); the confirm says "Replace all data".
- UX-18: sale delete states the total and, when paid, "Payments of MX$… will stay as general credit for <client>"; payment delete states the balance effect. Stores expose `removalBlocker(id)`; product and client deletes show the reason (role=alert) instead of a confirm that would fail.
- UX-24: SaleForm exposes `draftSize()`; backdrop, × and Escape ask "Discard this sale? The N items you added will be lost." (danger). Edit mode counts only changed/removed lines. Saving still closes directly.
- UX-27: ActionMenu follows the menu-button pattern: open focuses the first item (ArrowUp on the trigger: last), Up/Down/Home/End move, Escape closes and returns focus, Tab and focus moving outside close it; items are `tabindex="-1"`.
- UX-28: persistent "Done" in the product form header once the product exists; Variations tab says "Changes here save automatically." (save model kept — decision: least invasive).
- UX-43: advancing a scheduled tanda from open asks first ("Pre-orders will close — no new sales can be taken…"); anticipated tandas unchanged.
- RED observed: confirm tone (2), ActionMenu (2 of 3), SaleDialog draft protection, destructive.spec (3) failed before; sale-delete copy re-verified RED by stashing SaleList.vue.
- Checks: unit 25 files / 138 tests passed; type-check 0 errors; lint clean; e2e chromium+firefox 12/12 (journey now confirms the production advance).


### T5 — Content & consistency (commit 9f2140b)
- UX-22: option hints show the stock count only for stock-limited (anticipated) tandas; scheduled shows just the price.
- UX-25: `shared/ui/badges.ts` centralizes status/type → class + label for dashboard, list, header, status flow and client page. New gray `badge-neutral` (`--color-neutral-soft/ink`, contrast-tested) and amber `badge-warning` (production only). Decision: price-mode badges and "General" payments are gray facts.
- UX-29: client sales grouped per tanda (heading link with name, date, status, pending total; newest tanda date first) with a per-sale "Record payment" that sets `?pay=` and pre-selects the sale in the payment form on the same page.
- UX-34: `.badge` no longer capitalizes; enum labels are capitalized in code; `capitalize` also dropped from variation names and the pricing checkbox labels.
- UX-35: product thumbnails use `alt=""`.
- UX-40: `appLocale()` (navigator.languages[0] → navigator.language → en-US, validated) for money, dates and date-times. Decision: no new locale setting; the browser locale is the least invasive option.
- UX-41: tandas table wrapped in the shared `.table-card`; global `.table .col-num` (right-aligned, tabular-nums) used by tandas, inventory and the clients money columns.
- UX-44: Clients FAB ("New client") scrolls the create field into view, focuses it and highlights it briefly (motion-safe).
- UX-47: locked inventory hides never-produced SKUs and empty product groups; red only when produced > 0 and available = 0.
- Extra (found while testing UX-23): sale lines of a product without variations rendered "Cookies box ()" — label now omits empty parens (repo `buildSaleDetails`). Regression from the UX-01 default SKU, fixed here with a test.
- RED observed: useSaleDraft hint, InventoryEditor (2), badges (missing module), format locale, ClientSalesList, SaleList label all failed before, pass after.
- Checks: unit 30 files / 147 tests passed; type-check 0 errors; lint clean; e2e chromium+firefox 12/12 (Clients FAB focus assertion added).


### T6 — Perceived performance (commit 3f5ec46; remediation table in `docs/UX-AUDIT.md` §7: 3ffa58f)
- UX-30: `index.html` ships a static splash inside `#app` (`role="status"`, "Loading Mini Tanda…", spinner that honors reduced motion, token colors with OS-theme fallbacks) that Vue replaces on mount. `bootstrap()` failures render `renderBootError` (`src/core/bootError.ts`): `role="alert"` panel with a heading, likely causes (private window, full storage, blocked site data), steps incl. Export/Reset guidance, technical detail and a focused Reload button.
- Decision: no in-page "Reset data" button (it would delete everything with no way back); reset is explained as guidance only.
- RED observed: `bootError.spec.ts` failed (missing module) before. New e2e aborts the `.wasm` request and asserts the error screen.
- Checks: unit 31 files / 149 tests passed; type-check 0 errors; lint clean; `bun run build-only` OK (dist/index.html contains the splash); e2e chromium+firefox 14/14 passed.

## Next step
Done — remediation status recorded in `docs/UX-AUDIT.md`. Push/PR is the user's decision.
