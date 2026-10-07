# Feature: ux-craft-sev34

## Objective
Add the ux-craft audit to the repo and fix its severity 4 and 3 findings (A-01..A-09).

## Scope / constraints
App `mini-tandas-vapp/`; behavior per `docs/SPECS.md`; no new dependencies. Sev 2/1 findings are out of scope. Never commit the pre-staged root `.gitignore` or `.engram/`.
Source report: session scratchpad `ux-craft/UX-CRAFT-AUDIT.md` (+ `shots/`).

## Checks
`bun run test:unit --run`, `bun run type-check`, `bun run lint`; e2e at closure via `bun run build-only && CI=1 bunx playwright test --retries=0 --project=chromium --project=firefox`.

## Delivery
Branch `fix/ux-craft-sev34` (from `fix/ui-polish`), one Conventional Commit per task. Push/PR decided by user.

## Route
Delegated direct (writer trigger: multi-file). RDD off (global).

## Tasks
- [x] T0 Add `docs/UX-CRAFT-AUDIT.md` + only the screenshots it references for sev 4/3 findings (`docs/ux-craft-audit/`), fixing relative paths.
- [x] T1 A-01 Accent/case-insensitive search in Combobox (+ "did you mean" for near-duplicate client names on create).
- [x] T2 A-04 Combobox closes on blur/outside pointer without a click-eating backdrop.
- [x] T3 A-02 Sale sheet is history-aware: Back closes it and asks before discarding a draft.
- [x] T4 A-05 Product editor has its own route (`/products/:id`, `/products/new`) with leave confirmation for unsaved changes.
- [x] T5 A-06 Rename client.
- [ ] T6 A-03 Payment above outstanding balance: inline warning with "Apply <balance>" or "Record as credit".
- [ ] T7 A-07 Tanda sales: summary bar (count, total, paid, pending, delivered) + filter chips (all / unpaid / undelivered).
- [ ] T8 A-08 Toasts pause on hover/focus; "Replace all data" also offers restore from Settings.
- [ ] T9 A-09 Inputs font-size >= 16px on mobile.
- [ ] T10 Update `docs/UX-CRAFT-AUDIT.md` with a remediation status section.

## Progress / evidence
- T0 (inline in writer): audit copied to `docs/UX-CRAFT-AUDIT.md`; only the 3 screenshots cited by A-01..A-09 copied (`22-accent-search-1440-light.png`, `23-overpay-1440-light.png`, `03-tanda-open-sched-375-light.png`, ~316 KB); other screenshot references became "(captura no incluida)"; no absolute scratchpad paths. Baseline: unit 203/203 (one timeout flake seen under load avg ~30, green on rerun), type-check ok, lint ok. Commit `636a409`.

- T1 (delegated writer): `shared/domain/text.ts` (`foldText`, `matchesQuery`, `findNearMatch`) + tests; Combobox filters on folded text, treats a folded-equal name as existing (no Create row), lists folded partial matches ("jose" → "José Hernández") above "+ Create", and shows "Did you mean <name>?" (selects the existing option, Create stays available) for a near match the query does not literally contain (an existing folded name that is a whole-word prefix of the query, e.g. "Ana Lopez Garcia" → "Ana López"). Decision: no "Did you mean" row for names already listed as matches, to avoid duplicate rows on every prefix search (e2e types "Marí"/"An"). RED: 4 Combobox tests failed before implementation. Checks: unit 215/215, type-check ok, lint ok. Commit `04b179c`.

- T2: removed the teleported full-screen `.combo-backdrop`; the list closes on input blur (focus leaving the field) and on a capture-phase `document` `pointerdown` outside the input and list (registered only while open, never `preventDefault`), so the first tap on another control lands. The list now opens on click/typing/arrows instead of on focus, so programmatic focus (focus returning from a dialog, focus after adding a line) no longer reopens it. Escape still closes only the list. RED: 4 of 5 new dismissal tests failed before. Checks: unit 221/221, type-check ok, lint ok. Commit `aed215f`.

- T3: new `shared/ui/useBackToClose.ts` — while mounted, the overlay owns one same-URL history entry (copies the router state + `overlay` key); Back pops it and runs the close request (returns false → entry re-pushed); a normal close removes it with `history.back()` only if it is still the current entry. SaleDialog uses it with the same `requestClose` as ×/Esc/backdrop (confirm when lines exist; still synchronous when empty) and exposes `confirmDiscard`; `pages/tandas/[id].vue` adds `onBeforeRouteLeave` that asks while the sheet holds a draft (and cancels while a confirm is already open). Tests: `useBackToClose.spec.ts` (3) + `e2e/history.spec.ts` (page.goBack: empty sheet closes, draft asks, Cancel keeps it, second Back while asking stays, Discard closes, no stray entry; × leaves no entry). Checks: unit 224/224, type-check ok, lint ok, e2e history 4/4 (chromium+firefox). Commit `28379fa`.

- T4: routes `/products` (list), `/products/new` (`pages/products/new.vue`) and `/products/:id` (`pages/products/[id].vue`), both thin pages over the new `features/products/components/ProductEditor.vue` (not-found state with h1, page title, `?tab=variations` kept in the URL, `onBeforeRouteLeave` + `beforeunload` while the General tab has unsaved edits). First save `router.replace`s `/products/new` → `/products/:id?tab=variations`, so Back from the editor lands on the list. Cancel/Done reuse the list entry (`router.back()` when `history.state.back` is `/products`, else push). "New product" (desktop button and mobile FAB) became RouterLinks; row Edit pushes `/products/:id`. `ProductGeneralTab` exposes `hasUnsavedChanges()` (trimmed snapshot vs last loaded/saved + photo change); `ProductForm` takes `v-model:tab`, exposes it, and its heading became the page `h1`. e2e: "New product" is now a link; new history test (Back asks, Cancel keeps text, save → own URL on pricing tab survives reload, Back → list, nav link with unsaved edit asks). Note: the vue-router plugin regenerates the tracked `mini-tandas-vapp/typed-router.d.ts` (+30 lines for the new routes) on build; it is outside this feature's allowed edit surfaces, so it is left uncommitted in the working tree (code does not depend on the typed names; type-check passes with the committed version too). Checks: unit 226/226, type-check ok, lint ok, e2e full 24/24 (chromium+firefox). Commit `b3001aa`.

- T5: repo `renameClient(id, name)`; store `renameClient` (trims, rejects empty with "Enter a name.") and `nameTakenBy(name, exceptId)` (folded comparison). New `features/clients/components/RenameClientDialog.vue` (modal dialog: focus on the field, Esc/×-less Cancel, Back closes via `useBackToClose`, scroll lock, field error with `aria-invalid`/`aria-describedby`; a same-name client shows an inline warning and the button becomes "Rename anyway"; success toast "Renamed "A" to "B"."). `ActionMenu` gained `editLabel`; client list rows (table + cards) and the client summary card show "Rename". Shared `.warning-text` style (warning-soft/warning-ink, the badge pair that already passes AA). Tests: `rename-client.spec.ts` (4), `RenameClientDialog.spec.ts` (5), `e2e/clients.spec.ts` (list + client page, duplicate warning). Checks: unit 235/235, type-check ok, lint ok, e2e clients 2/2. Commit: see T6 entry.

## Next step
T6.
