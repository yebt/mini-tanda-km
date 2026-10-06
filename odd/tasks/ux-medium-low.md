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
- [ ] T2 Responsive, mobile & touch: UX-09, UX-13, UX-14, UX-15, UX-32, UX-33, UX-38, UX-39, UX-46
- [ ] T3 Feedback, errors & forms: UX-19, UX-20, UX-21, UX-23, UX-31, UX-36, UX-37
- [ ] T4 Dialogs, menus & destructive actions: UX-17, UX-18, UX-24, UX-27, UX-28, UX-43
- [ ] T5 Content & consistency: UX-22, UX-25, UX-29, UX-34, UX-35, UX-40, UX-41, UX-44, UX-47
- [ ] T6 Perceived performance: UX-30

## Progress / evidence

### T1 — Navigation, IA & semantics (commit: see git log `fix(ux): navigation`)
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

## Next step
T2.
