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
- [ ] T1 A-01 Accent/case-insensitive search in Combobox (+ "did you mean" for near-duplicate client names on create).
- [ ] T2 A-04 Combobox closes on blur/outside pointer without a click-eating backdrop.
- [ ] T3 A-02 Sale sheet is history-aware: Back closes it and asks before discarding a draft.
- [ ] T4 A-05 Product editor has its own route (`/products/:id`, `/products/new`) with leave confirmation for unsaved changes.
- [ ] T5 A-06 Rename client.
- [ ] T6 A-03 Payment above outstanding balance: inline warning with "Apply <balance>" or "Record as credit".
- [ ] T7 A-07 Tanda sales: summary bar (count, total, paid, pending, delivered) + filter chips (all / unpaid / undelivered).
- [ ] T8 A-08 Toasts pause on hover/focus; "Replace all data" also offers restore from Settings.
- [ ] T9 A-09 Inputs font-size >= 16px on mobile.
- [ ] T10 Update `docs/UX-CRAFT-AUDIT.md` with a remediation status section.

## Progress / evidence
- T0 (inline in writer): audit copied to `docs/UX-CRAFT-AUDIT.md`; only the 3 screenshots cited by A-01..A-09 copied (`22-accent-search-1440-light.png`, `23-overpay-1440-light.png`, `03-tanda-open-sched-375-light.png`, ~316 KB); other screenshot references became "(captura no incluida)"; no absolute scratchpad paths. Baseline: unit 203/203 (one timeout flake seen under load avg ~30, green on rerun), type-check ok, lint ok. Commit: see T1 entry.

## Next step
T1.
