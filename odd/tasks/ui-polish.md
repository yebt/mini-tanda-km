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
- [x] T3 Pricing "Price depends on": replace plain checkboxes with selectable chips/cards showing option counts (still checkboxes).
- [x] T4 Focus flow: after "Add option" focus returns to that "New option" input; after "Add variation" focus moves to the new variation's "New option" input.
- [x] T5 FAB: center the "+" icon optically (icon, not text glyph).
- [x] T6 Sale lines: one consistent quantity stepper component (equal heights, single border group) used in the add-line row and item rows; aligned item card layout.

## Progress / evidence
- T1 (delegated writer): preview tile (thumbnail or dashed ImagePlus placeholder, drop target) + "Choose photo"/"Change photo" label-button over a visually hidden but focusable `<input type="file" accept="image/*">` + "Remove photo" ghost action; hint tied via aria-describedby; 1 MB validation kept, non-image drops rejected. Tests: `ProductGeneralTab.spec.ts` (RED 2/3 failing before, GREEN after). Checks: test:unit 36 files/183 passed, type-check ok, lint ok. Commit `a81393b`.
- T2: shared `.choice-group/.choice-grid/.choice-card/.choice-input` primitives in `main.css` (native radio restyled: ring + dot, card gets primary border/inset ring + primary-soft fill when checked, focus ring on the card via `:has(:focus-visible)`); price mode is a fieldset/legend radio group of two title+description cards (aria-labelledby title, aria-describedby description). Contrast spec extended (ink/ink-soft on primary-soft >= 4.5, primary/focus-ring on primary-soft >= 3). Tests: price-mode spec RED (1 failing) then GREEN. Checks: test:unit 36 files/192 passed, type-check ok, lint ok. Commit `55f15d4`.
- T3: "Price depends on" is a fieldset/legend of checkbox choice cards (variation name + "N options", compact 2-up grid on mobile); checkbox variant of `.choice-input` (rounded square, primary fill + check mark); intro copy shortened. Tests: `PricingSection.spec.ts` RED (1 failing) then GREEN. Checks: test:unit 37 files/194 passed, type-check ok, lint ok. Commit `8ef9eb9`.
- T4: VariationEditor keeps a map of "New option" inputs (function refs); "Add option" (click or Enter) clears and refocuses that input; "Add variation" (click or Enter) remembers the new id and focuses its "New option" input once the prop re-renders (nextTick + post-flush watch). Tests: `VariationEditor.spec.ts` asserting `document.activeElement`, RED (3 failing) then GREEN. Checks: test:unit 38 files/197 passed, type-check ok, lint ok. Commit `db85c85`.
- T5: all four FABs (products, tandas list, tanda detail, clients) render a Lucide `Plus` (26px, stroke 2.25, aria-hidden) centered by flex; text glyph and font metrics removed from `.fab`; explicit `:focus-visible` ring. Accessible names unchanged. Test: e2e mobile-shell asserts empty text, icon center within 0.5px of the FAB center and the accessible name — RED (text "+") then GREEN on chromium + firefox. Checks: test:unit 38 files/197 passed, type-check ok, lint ok. Commit `354fef8`.
- T6: new shared `src/shared/ui/QuantityStepper.vue` (v-model, min/max clamping with min winning over a lower max, typed values capped live and invalid/below-min text reverted on change, ArrowUp/Down/Home/End, Enter emits `enter`; one bordered group with borderless input, group focus ring while typing, inset ring on focused buttons; md 44px / sm 36px, 44px on coarse pointers). Used for the pending-line composer ("Quantity", max = remaining stock) and every item row ("Units of …", max = line cap); "Add line" now 44px with the same border. Item rows are a grid: mobile name + unit price with remove top-right over stepper | line total; desktop one row with a fixed total column so steppers align across rows. Inventory has plain produced-quantity inputs, no stepper — left unchanged. Tests: `QuantityStepper.spec.ts` RED (missing component) then GREEN; SaleForm stepper integration test added. Checks: test:unit 39 files/203 passed, type-check ok, lint ok; Impeccable detector: no findings.

## Next step
Final e2e + docs(odd) commit.
