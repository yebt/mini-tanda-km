# Feature: ui-polish

## Objective
Polish product-form controls, focus flow, the FAB and sale lines based on user screenshots (2026-10-07).

## Scope / constraints
App `mini-tandas-vapp/`; no new dependencies; keep the visual identity, tokens and a11y fixes (labels, focus visibility, contrast >= AA). Never commit the pre-staged root `.gitignore` or `.engram/`.

## Checks
`bun run test:unit --run`, `bun run type-check`, `bun run lint`; e2e at closure via `bun run build-only && CI=1 bunx playwright test --retries=0 --project=chromium --project=firefox`; before/after screenshots (desktop + mobile, light + dark) in the scratchpad.

## Delivery
Branch `fix/ui-polish` (from `fix/perf-and-spacing`), one Conventional Commit per task. Push/PR decided by user.

## Route
Delegated direct (writer trigger: multi-file). RDD off (global).

## Tasks
- [x] T1 Photo field: replace the raw native file input with a styled picker (preview, choose/change, remove), keeping a real labelled file input.
- [x] T2 Price mode: replace plain radios with selectable option cards / segmented control (still a radio group).
- [ ] T3 Pricing "Price depends on": replace plain checkboxes with selectable chips/cards showing option counts (still checkboxes).
- [ ] T4 Focus flow: after "Add option" focus returns to that "New option" input; after "Add variation" focus moves to the new variation's "New option" input.
- [ ] T5 FAB: center the "+" icon optically (icon, not text glyph).
- [ ] T6 Sale lines: one consistent quantity stepper component (equal heights, single border group) used in the add-line row and item rows; aligned item card layout.

## Progress / evidence
- T1 (delegated writer): preview tile (thumbnail or dashed ImagePlus placeholder, drop target) + "Choose photo"/"Change photo" label-button over a visually hidden but focusable `<input type="file" accept="image/*">` + "Remove photo" ghost action; hint tied via aria-describedby; 1 MB validation kept, non-image drops rejected. Tests: `ProductGeneralTab.spec.ts` (RED 2/3 failing before, GREEN after). Checks: test:unit 36 files/183 passed, type-check ok, lint ok. Commit `a81393b`.
- T2: shared `.choice-group/.choice-grid/.choice-card/.choice-input` primitives in `main.css` (native radio restyled: ring + dot, card gets primary border/inset ring + primary-soft fill when checked, focus ring on the card via `:has(:focus-visible)`); price mode is a fieldset/legend radio group of two title+description cards (aria-labelledby title, aria-describedby description). Contrast spec extended (ink/ink-soft on primary-soft >= 4.5, primary/focus-ring on primary-soft >= 3). Tests: price-mode spec RED (1 failing) then GREEN. Checks: test:unit 36 files/192 passed, type-check ok, lint ok.

## Next step
T3.
