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
- [x] T6 A-03 Payment above outstanding balance: inline warning with "Apply <balance>" or "Record as credit".
- [x] T7 A-07 Tanda sales: summary bar (count, total, paid, pending, delivered) + filter chips (all / unpaid / undelivered).
- [x] T8 A-08 Toasts pause on hover/focus; "Replace all data" also offers restore from Settings.
- [x] T9 A-09 Inputs font-size >= 16px on mobile.
- [x] T10 Update `docs/UX-CRAFT-AUDIT.md` with a remediation status section.

## Progress / evidence
- T0 (inline in writer): audit copied to `docs/UX-CRAFT-AUDIT.md`; only the 3 screenshots cited by A-01..A-09 copied (`22-accent-search-1440-light.png`, `23-overpay-1440-light.png`, `03-tanda-open-sched-375-light.png`, ~316 KB); other screenshot references became "(captura no incluida)"; no absolute scratchpad paths. Baseline: unit 203/203 (one timeout flake seen under load avg ~30, green on rerun), type-check ok, lint ok. Commit `636a409`.

- T1 (delegated writer): `shared/domain/text.ts` (`foldText`, `matchesQuery`, `findNearMatch`) + tests; Combobox filters on folded text, treats a folded-equal name as existing (no Create row), lists folded partial matches ("jose" → "José Hernández") above "+ Create", and shows "Did you mean <name>?" (selects the existing option, Create stays available) for a near match the query does not literally contain (an existing folded name that is a whole-word prefix of the query, e.g. "Ana Lopez Garcia" → "Ana López"). Decision: no "Did you mean" row for names already listed as matches, to avoid duplicate rows on every prefix search (e2e types "Marí"/"An"). RED: 4 Combobox tests failed before implementation. Checks: unit 215/215, type-check ok, lint ok. Commit `04b179c`.

- T2: removed the teleported full-screen `.combo-backdrop`; the list closes on input blur (focus leaving the field) and on a capture-phase `document` `pointerdown` outside the input and list (registered only while open, never `preventDefault`), so the first tap on another control lands. The list now opens on click/typing/arrows instead of on focus, so programmatic focus (focus returning from a dialog, focus after adding a line) no longer reopens it. Escape still closes only the list. RED: 4 of 5 new dismissal tests failed before. Checks: unit 221/221, type-check ok, lint ok. Commit `aed215f`.

- T3: new `shared/ui/useBackToClose.ts` — while mounted, the overlay owns one same-URL history entry (copies the router state + `overlay` key); Back pops it and runs the close request (returns false → entry re-pushed); a normal close removes it with `history.back()` only if it is still the current entry. SaleDialog uses it with the same `requestClose` as ×/Esc/backdrop (confirm when lines exist; still synchronous when empty) and exposes `confirmDiscard`; `pages/tandas/[id].vue` adds `onBeforeRouteLeave` that asks while the sheet holds a draft (and cancels while a confirm is already open). Tests: `useBackToClose.spec.ts` (3) + `e2e/history.spec.ts` (page.goBack: empty sheet closes, draft asks, Cancel keeps it, second Back while asking stays, Discard closes, no stray entry; × leaves no entry). Checks: unit 224/224, type-check ok, lint ok, e2e history 4/4 (chromium+firefox). Commit `28379fa`.

- T4: routes `/products` (list), `/products/new` (`pages/products/new.vue`) and `/products/:id` (`pages/products/[id].vue`), both thin pages over the new `features/products/components/ProductEditor.vue` (not-found state with h1, page title, `?tab=variations` kept in the URL, `onBeforeRouteLeave` + `beforeunload` while the General tab has unsaved edits). First save `router.replace`s `/products/new` → `/products/:id?tab=variations`, so Back from the editor lands on the list. Cancel/Done reuse the list entry (`router.back()` when `history.state.back` is `/products`, else push). "New product" (desktop button and mobile FAB) became RouterLinks; row Edit pushes `/products/:id`. `ProductGeneralTab` exposes `hasUnsavedChanges()` (trimmed snapshot vs last loaded/saved + photo change); `ProductForm` takes `v-model:tab`, exposes it, and its heading became the page `h1`. e2e: "New product" is now a link; new history test (Back asks, Cancel keeps text, save → own URL on pricing tab survives reload, Back → list, nav link with unsaved edit asks). Note: the vue-router plugin regenerates the tracked `mini-tandas-vapp/typed-router.d.ts` (+30 lines for the new routes) on build; it is outside this feature's allowed edit surfaces, so it is left uncommitted in the working tree (code does not depend on the typed names; type-check passes with the committed version too). Checks: unit 226/226, type-check ok, lint ok, e2e full 24/24 (chromium+firefox). Commit `b3001aa`.

- T5: repo `renameClient(id, name)`; store `renameClient` (trims, rejects empty with "Enter a name.") and `nameTakenBy(name, exceptId)` (folded comparison). New `features/clients/components/RenameClientDialog.vue` (modal dialog: focus on the field, Esc/×-less Cancel, Back closes via `useBackToClose`, scroll lock, field error with `aria-invalid`/`aria-describedby`; a same-name client shows an inline warning and the button becomes "Rename anyway"; success toast "Renamed "A" to "B"."). `ActionMenu` gained `editLabel`; client list rows (table + cards) and the client summary card show "Rename". Shared `.warning-text` style (warning-soft/warning-ink, the badge pair that already passes AA). Tests: `rename-client.spec.ts` (4), `RenameClientDialog.spec.ts` (5), `e2e/clients.spec.ts` (list + client page, duplicate warning). Checks: unit 235/235, type-check ok, lint ok, e2e clients 2/2. Commit `045dd81`.

- T6: PaymentForm computes `overpay` (cents comparison) when a sale is selected and the amount exceeds its balance; an inline `.warning-text` notice (role=status, tied to the amount with `aria-describedby`) says "This sale only owes $120.00. Recording $5,000.00 pays it in full and keeps $4,880.00 as credit for the client." with "Apply $120.00" (sets the amount to the balance and refocuses it) and "Record as credit". Submitting while over does not record and moves focus to "Apply". Decision (least surprising): "Record as credit" splits into a sale payment for the exact balance + a general payment (abono) for the excess, so the sale reads Paid instead of a negative balance and the client's combined balance carries the credit; one toast with a single Undo removes both. General payments never warn. RED: 3 new tests failed before. Checks: unit 239/239, type-check ok, lint ok. Commit `c965877`.

- T7: pure `features/tandas/lib/saleSummary.ts` (`summarizeSales` in cents — pending ignores overpaid sales —, `filterSales`, `parseSaleFilter`) + tests; new presentational `SalesSummaryBar.vue` ("3 sales · $400.00 total · $150.00 paid · $250.00 pending · 2/3 delivered", pending in danger tone with its label) and `SaleFilterChips.vue` (group "Filter sales", All / Unpaid / Undelivered with counts, `aria-pressed`, tonal fill + doubled border, 44 px on coarse pointers). SaleList keeps the filter in `?filter=` (router.replace, merged with `?tab=`), hides bar/chips when there are no sales, and shows "Every sale is paid." / "Every sale is delivered." with "Clear filter" when a filter empties the list. RED: 5 SaleList tests failed before. Checks: unit 249/249, type-check ok, lint ok, e2e chromium 13/13. Commit `3db84a8`.

- T8: `useToast` tracks a per-toast clock (remaining time + holds); `holdToast/releaseToast(id, 'hover'|'focus')` pause and resume with the time left, resuming only when neither hover nor focus holds it; ToastHost wires `pointerenter/leave` and `focusin/focusout` (focus moving between the toast's own buttons keeps the hold). Undo toasts last 10 s (was 8 s); dropped toasts clear their timers. Restore decision: the settings store keeps an in-memory `restorePoint` (pre-import export + time) set by `replaceAllData` only after a successful (transactional) import; only the latest import is kept; `restorePrevious()` re-imports it and clears it; `dismissRestorePoint()` forgets it. The Undo toast uses the same path (no extra confirm); Settings shows a panel "Data replaced by an import on <date>…" with "Restore previous data" (danger confirm: changes since the import will be lost) and "Keep imported data". Session-only by design (lost on reload, stated in the copy); the import confirm no longer promises an undo "right after" only. Tests: toast timing (3), store restore point (3), settings page (3). Checks: unit 258/258, type-check ok, lint ok. Commit `f2f9c03`.

- T9: `main.css` sets `.input, .select, .textarea { font-size: max(16px, 1rem) }` at ≤720px (covers Combobox `.combo-input`, price/date/name/inventory inputs); `QuantityStepper`'s scoped `.qty-input` (which uses `font: inherit` from the 15px body) gets the same rule. `font: inherit` (A-12) was not needed for this fix and stays out of scope (it would change the control font family app-wide). Test: `e2e/inputs.spec.ts` at 375 px measures computed font-size of every text field on the product editor, the tanda page and the sale sheet. RED: 15.2px observed before. Checks: unit 258/258, type-check ok, lint ok, e2e inputs 2/2 (chromium+firefox). Commit `2ddbba6`.

- T10: "Estado de remediación" section appended to `docs/UX-CRAFT-AUDIT.md` (A-01..A-09 fixed with commit hashes, sev 2/1 pending, parts of the proposed fixes left for the backlog). Closure checks: unit 258/258, type-check ok, lint ok, `bun run build-only` ok, `CI=1 bunx playwright test --retries=0 --project=chromium --project=firefox` 28/28. Visual check (§8): 375 px light/dark screenshots of sale summary + chips, overpay notice and rename dialog reviewed (session scratchpad, not committed). Commit: see final docs(odd) commit.

## Open items
- `mini-tandas-vapp/typed-router.d.ts` is regenerated by the vue-router plugin with the new `/products/new` and `/products/[id]` routes; it is tracked but outside this feature's allowed edit surfaces, so it remains modified and uncommitted (code does not depend on it; type-check passes with either version).
- Push / PR: user decision.

## Next step
Review the branch; decide on committing `typed-router.d.ts` and on push/PR.
