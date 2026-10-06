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
- [ ] T4 Dialogs, menus & destructive actions: UX-17, UX-18, UX-24, UX-27, UX-28, UX-43
- [ ] T5 Content & consistency: UX-22, UX-25, UX-29, UX-34, UX-35, UX-40, UX-41, UX-44, UX-47
- [ ] T6 Perceived performance: UX-30

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


### T3 — Feedback, errors & forms (commit: next after 248d170)
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

## Next step
T4.
