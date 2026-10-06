# Mini Tanda — UX Audit

- **Date:** 2026-10-06
- **Branch:** `audit/ux`
- **Scope:** every page and component in `mini-tandas-vapp/src` (`src/pages`, `src/features`, `src/shared/ui`, `src/core/App.vue`, `src/shared/assets/main.css`), checked against `docs/SPECS.md`.
- **Method:** static code review, plus a production build (`vite build`) served with `vite preview` on port 4317 and driven with Playwright/Chromium. Data was seeded only through the UI: 3 products (one with 2 variations and per-SKU pricing by SIZE, one with a global price and no variations, one per-SKU product with no prices), 4 clients (one with a very long name), a scheduled tanda (open, 3 sales), an anticipated tanda (inventory → production → ready, sale made from the inventory, delivery marked), plus sale-linked payments. Contrast ratios were computed from the CSS tokens with the WCAG 2.x relative-luminance formula. Touch targets were measured with `getBoundingClientRect` at 390×844.
- **Evidence:** screenshots in [`docs/ux-audit/`](ux-audit/). File paths are relative to `mini-tandas-vapp/`.
- **Rule sources:** Vercel Web Interface Guidelines (fetched 2026-10-06 from `vercel-labs/web-interface-guidelines/command.md`), WCAG 2.2 AA, Nielsen's 10 heuristics, Laws of UX (Yablonski), and the Impeccable audit rubric.

---

## 1. Executive summary

Mini Tanda already looks polished. It has a warm, consistent token palette with a dark theme that works, sensible responsive patterns (tables on desktop, cards and a bottom nav on mobile, a bottom-sheet sale dialog), strong body-text contrast, and a well-made sale composer (44px steppers, sticky total, focus going back to product search). Most problems sit **beneath that surface**:

1. **A spec-breaking dead end.** A product with no variations never gets a SKU, so it cannot be stocked or sold. It still shows up as "MX$120.00 · Global price" in the catalog, which makes the failure look like a picker bug ("No matches"). (UX-01)
2. **Keyboard and screen-reader access to the core flow is weak.** The sale dialog and the confirm dialog do not take focus or respond to Escape. The combobox cannot be driven with the arrow keys. The delivered toggle shows no focus at all. Several inputs have no accessible name. (UX-02, UX-03, UX-06, UX-07)
3. **Contrast fails on secondary UI.** Every status and type badge fails WCAG 1.4.3 (3.83–4.34:1 at 11px bold), and input borders reach only 1.32:1 against the surface (1.4.11). (UX-04, UX-05)
4. **Feedback is thin.** Saves are silent, errors are not announced, a backdrop tap throws away a draft sale, and disabled controls never say why. (UX-19, UX-20, UX-24, UX-25)

**47 findings:** 1 critical, 7 high, 22 medium, 17 low.

### Scores per dimension (0–10)

| Dimension | Score | Main driver |
|---|:-:|---|
| Accessibility | **4** | Dialog and combobox keyboard support, badge contrast, unlabeled inputs, invisible toggle focus |
| Visual hierarchy / layout | **7** | Clear cards and one primary action per view. The mobile dashboard pushes "Next up" below the fold |
| Typography | **7** | One system font, tabular money figures, restrained scale. 10px nav labels; `capitalize` rewrites user text |
| Color / theming | **6** | Full token set and a working dark theme. Status colors mean different things on different screens; badges fail contrast |
| Interaction & feedback | **5** | No success feedback, unexplained disabled states, the sale draft is lost on a backdrop tap |
| Forms & input | **5** | Unlabeled inputs, silent price rejection, a submit button that stays disabled with no reason |
| Navigation / IA | **6** | Simple 5-item IA. The back button shows on top-level pages, tab state is not in the URL, and there is no exit from the variations tab |
| Responsive / mobile | **6** | No overflow at 390px by default. The FAB covers content, small targets, a duplicate "New sale", and 200% text reflow fails |
| Content / microcopy | **7** | Clear captions and helper text. Misleading "0 available" hints; confirmations don't state consequences |
| Error / empty states | **5** | Empty states exist. Delete fails after you confirm, there is no boot loading or error state, and errors are not announced |
| Performance perception | **7** | App ready in ~350–500 ms (local, warm). A blank screen while the WASM DB loads; no skeletons needed elsewhere |
| Consistency with SPECS | **6** | Products without variations can't be sold. Client sales aren't grouped per tanda. Duplicate creation actions on mobile |
| **Overall** | **5.9** | |

Impeccable audit rubric (0–4 each): Accessibility 2 · Performance 3 · Responsive 3 · Theming 3 · Implementation integrity 3 → **14/20, "Good"**: work is needed on the weakest dimensions.

---

## 2. Rules

Findings cite these stable IDs.

### 2.1 WCAG 2.2 AA (A11Y)

| ID | Criterion | Summary |
|---|---|---|
| A11Y-01 | 1.1.1 Non-text Content | Images get correct alt text; decorative images use `alt=""` |
| A11Y-02 | 1.3.1 Info and Relationships | Structure (headings, labels, tabs) is exposed in markup |
| A11Y-03 | 1.4.1 Use of Color | Color is not the only carrier of meaning, and it is applied consistently |
| A11Y-04 | 1.4.3 Contrast (Minimum) | Text ≥ 4.5:1 (≥ 3:1 for ≥ 18.66px bold / 24px) |
| A11Y-05 | 1.4.4 Resize Text | Usable at 200% text size |
| A11Y-06 | 1.4.10 Reflow | No 2-D scrolling at 320 CSS px wide |
| A11Y-07 | 1.4.11 Non-text Contrast | UI component boundaries and states ≥ 3:1 |
| A11Y-08 | 2.1.1 Keyboard | All functionality is operable from the keyboard |
| A11Y-09 | 2.4.1 Bypass Blocks | A skip link or equivalent |
| A11Y-10 | 2.4.2 Page Titled | Each view has a descriptive title |
| A11Y-11 | 2.4.3 Focus Order | Focus moves logically, including into and out of dialogs |
| A11Y-12 | 2.4.6 Headings and Labels | Headings and labels describe their content |
| A11Y-13 | 2.4.7 Focus Visible | The keyboard focus indicator is visible |
| A11Y-14 | 2.4.11 Focus Not Obscured (Min) | Focused items are not hidden by sticky or fixed UI |
| A11Y-15 | 2.5.8 Target Size (Minimum) | Targets ≥ 24×24 CSS px (or adequately spaced) |
| A11Y-16 | 3.3.1 Error Identification | Errors are identified and described in text |
| A11Y-17 | 3.3.2 Labels or Instructions | Inputs have visible labels or instructions |
| A11Y-18 | 4.1.2 Name, Role, Value | Controls expose name, role, state, and relationships |
| A11Y-19 | 4.1.3 Status Messages | Status and error messages are announced without a focus change |

### 2.2 Web Interface Guidelines (WIG)

| ID | Guideline |
|---|---|
| WIG-01 | Icon-only buttons need `aria-label`; decorative icons are `aria-hidden` |
| WIG-02 | Every form control has a `<label>` or `aria-label` |
| WIG-03 | Visible `:focus-visible` states; never remove the outline without a replacement |
| WIG-04 | Async updates (toasts, validation) use `aria-live="polite"` |
| WIG-05 | Hierarchical headings; a skip link to main content |
| WIG-06 | Inputs have the right `type`/`inputmode`, `name`, and `autocomplete` |
| WIG-07 | Submit stays enabled until the request starts; errors sit inline next to fields; focus moves to the first error |
| WIG-08 | Placeholders end with `…` and show an example pattern |
| WIG-09 | Warn before discarding unsaved changes |
| WIG-10 | Destructive actions need a confirmation or an undo window, visually distinct |
| WIG-11 | The URL reflects state (tabs, filters, panels) |
| WIG-12 | `touch-action: manipulation`; `overscroll-behavior: contain` in sheets and modals |
| WIG-13 | Full-bleed or fixed layouts respect `env(safe-area-inset-*)` |
| WIG-14 | `<meta name="theme-color">` and `color-scheme` match the theme |
| WIG-15 | Text containers handle long content (truncate, wrap, `min-width: 0`) |
| WIG-16 | `tabular-nums` and consistent alignment for number columns |
| WIG-17 | Interactive states (hover, active, focus) are more prominent than the rest state |
| WIG-18 | Error messages include the fix or next step |
| WIG-19 | Loading states are visible and end with `…` |
| WIG-20 | Specific button labels; consistent casing |
| WIG-21 | `Intl.*` for dates, numbers, and currency, using the user's locale |
| WIG-22 | Honor `prefers-reduced-motion`; no `transition: all` |

### 2.3 Laws of UX (LAW)

| ID | Law | How it is applied here |
|---|---|---|
| LAW-01 | Jakob's law | Navigation and controls behave as users expect from other apps |
| LAW-02 | Fitts's law | Targets ≥ 44×44 px with ≥ 8 px spacing; destructive actions kept away from confirm actions; the completing action near the last touch |
| LAW-03 | Hick's law | One obvious next action; no duplicate or competing CTAs |
| LAW-04 | Miller's law (chunking) | Related information grouped into scannable chunks |
| LAW-05 | Doherty threshold | Response or feedback within 400 ms; perceived progress when slower |
| LAW-06 | Von Restorff effect | One focal point; destructive options visually distinct; no false alarms |
| LAW-07 | Tesler's law | The system absorbs complexity instead of the user |
| LAW-08 | Postel's law | Accept varied input, normalize it, and say what happened |
| LAW-09 | Peak–end rule | Completion moments and error moments get design care |

### 2.4 Usability heuristics (HEU, Nielsen)

| ID | Heuristic |
|---|---|
| HEU-01 | Visibility of system status |
| HEU-02 | Match between system and the real world (truthful copy) |
| HEU-03 | User control and freedom (escape, undo, exits) |
| HEU-04 | Consistency and standards |
| HEU-05 | Error prevention |
| HEU-06 | Recognition rather than recall |
| HEU-07 | Help users recognize, diagnose, and recover from errors |
| HEU-08 | Aesthetic and minimalist design |

### 2.5 SPECS conformance (SPEC, from `docs/SPECS.md`)

| ID | Spec requirement |
|---|---|
| SPEC-01 | Products without variations have a single price and can be sold |
| SPEC-02 | SKUs without a price or stock show disabled, with the reason; a SKU without a resolved price cannot be sold |
| SPEC-03 | On mobile, **deeper** pages get a back button; the bottom nav handles top-level navigation |
| SPEC-04 | The dashboard shows the next tanda with its status and pending amount |
| SPEC-05 | The client page shows their sales **per tanda** and their payment history |
| SPEC-06 | Dialogs are internal components; background scroll is locked |
| SPEC-07 | Sale lines UX: stepper, Enter adds a line, focus returns to search, total stays visible |
| SPEC-08 | Anticipated tandas: only SKUs that were produced can be sold |
| SPEC-09 | Mobile: lists become cards, creation actions become a FAB |

---

## 3. Findings

Severity: **critical** blocks a spec'd task. **High** is a WCAG AA failure in a core flow, or a dead end. **Medium** is real friction or a contained AA failure. **Low** is polish.
Screenshots are referenced as `[S:NN]` → `docs/ux-audit/NN-*.png`.

### 3.1 Critical

| ID | Sev | Rules | Evidence | User impact | Recommendation |
|---|---|---|---|---|---|
| UX-01 | critical | SPEC-01, HEU-01, HEU-05 | `src/shared/db/repos/products.ts:217-229`: `recomputeSkus` builds the cartesian product, then clears `desired` when there are no variations, so a product without variations has **zero SKUs**. At runtime, "Cookies box" (global price MX$120) was missing from the sale picker ("No matches" for "Cookies") and rendered as an empty "COOKIES BOX" group in the inventory `[S:07]`, while the catalog shows it as priced `[S:02]` `[S:17]` | Simple products, which per the spec are the default case, cannot be sold or stocked. The UI shows them as ready, so the failure looks like a broken search | Generate one default SKU (`option_ids = []`) when a product has no variations, and backfill existing products in a migration. Add an e2e test: create a global-price product, then sell it. Until fixed, flag unsellable products in the catalog |

### 3.2 High

| ID | Sev | Rules | Evidence | User impact | Recommendation |
|---|---|---|---|---|---|
| UX-02 | high | A11Y-08, A11Y-11, A11Y-18, HEU-03 | `src/shared/ui/ConfirmDialogHost.vue:21-30` and `src/features/tandas/components/SaleDialog.vue:29-45`: no focus move, focus trap, Escape handler, or focus restore. The `alertdialog` has no `aria-labelledby`/`aria-describedby`. Runtime: with the confirm open, `document.activeElement` was `BODY`; Escape left both the confirm dialog and the sale dialog open `[S:10]` | Keyboard and screen-reader users land behind the modal, can Tab into the page underneath, and cannot dismiss it with Escape. Screen readers don't announce the question | Use a native `<dialog>` with `showModal()`, or a focus-trap utility: focus the first field (or Cancel for destructive confirms), close on Escape, return focus to the trigger, and link the title and message with `aria-labelledby`/`aria-describedby` |
| UX-03 | high | A11Y-08, A11Y-18, A11Y-11 | `src/shared/ui/Combobox.vue:162-207`: ArrowDown only opens the list. There is no active-option state, `aria-activedescendant`, or `aria-controls`, and Enter does not pick a highlighted option. Options are `<button>`s teleported to the end of `<body>`, so they sit outside the dialog's tab sequence. Runtime: after ArrowDown, focus stayed on `#sale-sku` and `aria-activedescendant` was `null` | Client and product selection, the heart of "New sale", needs a mouse or touch. Keyboard users effectively cannot create a sale | Implement the ARIA 1.2 combobox pattern: `aria-controls` pointing at the listbox id, a roving `aria-activedescendant` driven by Up/Down/Home/End, Enter to select, Escape to close, and options as `role="option"` elements with ids rather than buttons. Keep the Teleport and its positioning |
| UX-04 | high | A11Y-04, LAW-06 | `src/shared/assets/main.css:190-217`: badges are `0.75rem` (11.25px) bold. Computed ratios — light: info (primary on primary-soft) **4.04:1**, neutral (warning on warning-soft) **3.83:1**, success **4.34:1**; dark: info **4.06:1**. The same primary-on-primary-soft pair (4.04) is used for hovered or selected combobox options and menu items (`Combobox.vue:254-258`, `ActionMenu.vue:138-141`) `[S:00]` `[S:04]` `[S:13]` | Status, type, Paid/Pending, and price-mode labels (the app's main state signals) are hard to read for low-vision users and in sunlight on phones | Darken the badge foregrounds (e.g. light `--color-primary` text on soft → use `--color-primary-hover` #9c4719 = 5.11:1; add a darker warning ink such as `#7a5300` = 5.85:1 on warning-soft) or raise the badge size to ≥ 14px bold. Re-verify each pair in both themes |
| UX-05 | high | A11Y-07, A11Y-13, WIG-03 | `main.css:155-172`: input, select, and textarea border `#e8dfd2` on `#fff` = **1.32:1** (dark 1.38:1). The focus outline `--color-focus-ring #f6e4d7` on white = **1.24:1**, so the only usable focus cue is the 1px border turning primary `[S:11]`. The delivered toggle's off-track (`SaleList.vue:223-233`) = 1.32:1 | Field boundaries and the toggle's off state are close to invisible for low-vision users. Focus on inputs is subtle | Raise the border token to ≥ 3:1 against the surface (e.g. `#8e7f70` = 3.87:1 on white) or add an inner shadow. Replace the focus outline with a 2px `--color-primary` ring plus an offset (≥ 3:1). Give the toggle track a 3:1 border |
| UX-06 | high | A11Y-17, A11Y-18, WIG-02 | Unlabeled controls: tanda name and date inputs `src/features/tandas/components/TandaHeader.vue:59-60`; produced-quantity inputs `InventoryEditor.vue:75-82, 117-125`; price inputs `PriceTable.vue:78-87`; variation and option inputs that rely on placeholders only `VariationEditor.vue:92-111`; the "Photo" `<span>` is not tied to the file input `ProductGeneralTab.vue:104-110`; the "Data" `<label>` has no control `src/pages/settings/index.vue:86` | Screen readers announce "edit text" or "spin button" with no context: which SKU's quantity, which option's price. The labels disappear once the user types | Add a `<label for>`, or an `aria-label` built from row context (e.g. `` `Produced — ${sku.label}` ``, `` `Price for ${row.label}` ``). Turn "Data" and "Photo" into `<fieldset>`/`<legend>` or point them at the controls |
| UX-07 | high | A11Y-13, WIG-03 | `SaleList.vue:216-221`: the checkbox is `opacity:0; width:0; height:0`, and there is no `.delivered-input:focus-visible + .track` rule. Runtime probe: the focused track had `outline: none` and `box-shadow: none` | Keyboard users can toggle delivery but cannot see where focus is | Add `.delivered-input:focus-visible + .track { outline: 2px solid var(--color-primary); outline-offset: 2px }`. Consider `role="switch"` semantics |
| UX-08 | high | SPEC-02, SPEC-08, HEU-05 | `InventoryEditor.vue:31-33`: `canSellSku` checks only stock, not price. At runtime, "Flan (Large)" (no price) accepted 12 produced units and showed a **Sell** action `[S:07]`. The sale dialog lists the same SKU as disabled "No price set" `[S:06]` | The baker produces and "sells" a SKU that the sale form then refuses, a dead end discovered at checkout | Block or warn on stock entry for unpriced SKUs ("No price — set it in Products"), hide or disable Sell with the reason, and link to the product's pricing tab |

### 3.3 Medium

| ID | Sev | Rules | Evidence | User impact | Recommendation |
|---|---|---|---|---|---|
| UX-09 | medium | A11Y-05, A11Y-06 | At 200% text (root font-size simulation, 390px wide) the tanda page scrolls horizontally (`scrollWidth` 454 > 390). Inputs overflow the card, the caption wraps one word per line, and bottom-nav labels clip ("Set…") `[S:20]`. The nav height is fixed at 58px (`main.css:287`) and labels are `0.68rem` (`App.vue:160`) | Users who raise the system text size lose content and navigation | Let the header inputs wrap to `width:100%` on mobile, give the bottom nav `min-height` instead of `height`, hide or shorten labels at large sizes, and test with the browser's real text-zoom setting |
| UX-10 | medium | A11Y-10 | Runtime: `document.title` is "Mini Tanda" on `/`, `/tandas`, `/tandas/:id`, `/products`, `/clients`, `/settings`. No route sets a title (`src/core/router/index.ts`) | Tabs, history, and screen-reader page announcements can't tell views apart | Set `document.title` in `router.afterEach` from route meta and the entity name (e.g. "Weekend cakes · Tandas · Mini Tanda") |
| UX-11 | medium | A11Y-02, A11Y-12, WIG-05 | Dashboard has no `<h1>` (runtime count 0) and uses `<h2>` for bare numbers (`src/pages/index.vue:17,23,31`). An **open** tanda has no `<h1>` because the name renders as an input (`TandaHeader.vue:58-65`) `[S:05]` | The heading outline is broken. Screen-reader users can't jump to the page subject, and "2" is announced as a heading | Add a visually present `<h1>` ("Dashboard"; the tanda name with an edit affordance) and mark stat values up as `<p>`/`<data>` with the label as the heading |
| UX-12 | medium | A11Y-09, A11Y-11, WIG-05 | No skip link (runtime: 0 `a[href^="#"]`). Focus is not moved on route change, so it stays on the clicked nav link (`App.vue:37-73`) | Keyboard users re-tab through 6 header links on every view, and screen readers get no announcement of the new page | Add "Skip to content" targeting `<main tabindex="-1">`, and move focus to the new view's `<h1>` after navigation |
| UX-13 | medium | LAW-02, A11Y-15 | Measured at 390px: kebab "Actions" **34×24** (`ActionMenu.vue:86-96`), "Go back" **28×28** (`App.vue:104-113`), delivered toggle **24px** tall, buttons 32px, inputs 33px. From CSS: line remove 32×32 (`SaleForm.vue:418-430`), line steppers 36px (`SaleForm.vue:404-407`), option-chip "×" ≈ 15×19 (`VariationEditor.vue:146-154`, fails 2.5.8's 24px) | Mis-taps on a phone-first tool, especially the kebab next to the card and the tiny chip "×" that deletes SKUs | Make icon buttons ≥ 44×44 on coarse pointers (`@media (pointer: coarse)`), with ≥ 8px between them. Expand the chip remove hit area with padding or a pseudo-element |
| UX-14 | medium | A11Y-14, LAW-02 | The FAB sits at `bottom: nav + 16px`, is 56px tall, and has `z-index: 50` (`main.css:303-321`), while `.app-main` pads only `nav + 16px` (`App.vue:174-176`). Runtime: the FAB covers the "Sell" action of a row `[S:19]` and the sale card total `[S:15]` | Rows near the bottom are hidden or untappable; a focused control can sit under the FAB | Pad `.app-main` by `nav + 56 + 24px` on pages with a FAB, or add a FAB spacer |
| UX-15 | medium | SPEC-09, LAW-03, HEU-04 | On mobile the tanda detail shows both the toolbar "New sale" button and the FAB (`src/pages/tandas/[id].vue:88-106`) `[S:15]`. The dashboard's "New tanda" is a link to the list, not to the creation form (`src/pages/index.vue:40`) | Two identical CTAs compete. "New tanda" doesn't do what it says (one extra tap plus a hunt for the button) | Hide `.sales-toolbar` on mobile (`desktop-only`). Route "New tanda" to `/tandas?new=1` and open the form |
| UX-16 | medium | SPEC-03, LAW-01 | `App.vue:41`: the back button shows on every route except `/`, including top-level tabs `/tandas`, `/products`, `/clients`, `/settings` `[S:17]`. `router.back()` (`App.vue:32-34`) can leave the app after a deep link | Contradicts the spec ("deeper pages get a back button") and platform convention. Back may exit to another site | Show it only when `route.matched` depth > 1 (detail routes), and fall back to the parent list when history is empty |
| UX-17 | medium | LAW-06, LAW-02, WIG-10 | `ConfirmDialogHost.vue:25-27`: the confirm button is always `btn-primary`, sitting right next to Cancel. It is used for "Delete" (sale, product, client, payment) and for "Import", which replaces **all** data (`settings/index.vue:42-45`) `[S:10]` | Destructive actions look like the happy path; easy to confirm by reflex | Add a `tone: 'danger'` option rendering a danger-filled button. Separate Cancel from the destructive button. For "Import", require a typed confirmation or offer an automatic backup and undo |
| UX-18 | medium | HEU-05, WIG-18, HEU-07 | The delete-sale message is "Delete the sale for X?" (`SaleList.vue:40`) and never says its payments become general credit (a spec rule). Product and client delete ask for confirmation **first**, then fail with "cannot be deleted" (`src/pages/products/index.vue:43-52`, `src/pages/clients/index.vue:38-46`) | Users fear losing payments, or confirm a destructive action only to be told it was never possible | Put the consequence in the message ("Payments of MX$400 will stay as general credit"). Pre-check `productInUse` and the client's references, then show the reason instead of the confirm, or disable Delete with a tooltip |
| UX-19 | medium | A11Y-19, HEU-01, LAW-05, LAW-09 | Recording a payment (runtime: 0 `role=status/alert/aria-live` elements afterward), adding a client, creating or editing a sale, renaming a tanda, and committing a price are all silent. Only Settings import has `role="status"` (`settings/index.vue:102`) | No confirmation at the completion moments. Users repeat actions (double payments) or doubt they saved | Add a small toast/status region (`aria-live="polite"`) with the outcome and an Undo for deletions and payments |
| UX-20 | medium | A11Y-16, A11Y-19, WIG-07 | Error paragraphs have no `role="alert"`/`aria-describedby` and no `aria-invalid`: `PaymentForm.vue:103`, `ProductGeneralTab.vue:111,134`, `clients/index.vue:66,119`, `products/index.vue:66`. Runtime: the zero-amount payment error rendered with `role=alert` count 0. Only `SaleForm.vue:199` is announced | Screen-reader users don't learn that the submit failed | Link errors to their field (`aria-describedby`, `aria-invalid`), use `role="alert"` for form-level errors, and focus the first invalid field |
| UX-21 | medium | HEU-07, LAW-08, HEU-04 | `PriceTable.vue:56-63`: a typed `0`, a negative, or an invalid price is silently stored as "no price", while the General tab accepts `0` as valid ("Enter a valid price (0 or more)", `ProductGeneralTab.vue:69-75`). The input shows `min="0"` | A user enters 0 (a free item) and the value just vanishes. Two screens disagree on the rule | Use one rule in both places. Show an inline error instead of discarding, or accept 0 explicitly |
| UX-22 | medium | HEU-02, SPEC-02 | `src/features/tandas/composables/useSaleDraft.ts:97-101`: for scheduled tandas (no inventory) every option hint reads "MX$450.00 · **0 available**" `[S:06]` | Misreads as "sold out" on the pre-order flow, the opposite of reality | Show the stock count only when `limitedByStock` is true; otherwise show just the price |
| UX-23 | medium | HEU-01, HEU-06 | The delivered toggle is disabled (opacity .55 → label 2.40:1) with no reason until the tanda is ready (`SaleList.vue:75-94`) `[S:05]` | Users don't know why they can't mark a delivery | Add a hint ("Available once the tanda is ready") via `title` and `aria-describedby`, or hide the toggle before `ready` |
| UX-24 | medium | WIG-09, HEU-03 | `SaleDialog.vue:29`: a backdrop click or the "×" closes the dialog and drops the draft lines with no prompt. Runtime: tapping the mobile backdrop with 2 lines drafted closed the sheet (dialog count 0) | An accidental tap on the dimmed area wipes a multi-line order | Ask for confirmation when `lines.length > 0`, or keep the draft in state and restore it on reopen |
| UX-25 | medium | HEU-04, A11Y-03 | The status color map differs between screens: dashboard `open → amber, others → green` (`src/pages/index.vue:56`); list and detail `open → orange (info), production/closed → amber, ready → green` (`src/pages/tandas/index.vue:27-32`, `StatusFlow.vue:28-33`) `[S:00]` vs `[S:04]`. `badge-neutral` uses the *warning* colors (`main.css:199-202`), so "closed", "production", "Anticipated", "Price per SKU", and "General" payments all look like warnings | The same status shows in different colors on different screens, and neutral facts look alarming | Centralize `statusBadge(status)` and `typeBadge(type)` in one module. Add a true neutral (gray) badge, and keep amber for states that need attention |
| UX-26 | medium | A11Y-18, A11Y-08, WIG-11 | Tabs (`tandas/[id].vue:63-85`, `ProductForm.vue:57-78`) have `role="tab"` but no `aria-controls`/`tabpanel`, no arrow-key navigation, and no roving tabindex. Scheduled tandas render a one-tab tablist. The active tab is not in the URL (resets on reload or back) | Screen readers announce incomplete tabs. Reload loses the Inventory view. A single "tab" is noise | Implement the WAI-ARIA tabs pattern (or render plain headings when only one panel exists) and sync `?tab=` to the route |
| UX-27 | medium | A11Y-08, A11Y-18 | `ActionMenu.vue:48-76`: opening the menu leaves focus on the trigger (runtime: still "Actions" after ArrowDown), with no arrow-key movement between `menuitem`s. Escape is bound only on the trigger, and the menu doesn't close on focus-out | Keyboard users must Tab blindly into the menu, and focus can leave with the menu still open | Focus the first item on open, move with Up/Down, close on Escape or Tab from any item, and return focus to the trigger |
| UX-28 | medium | HEU-03, HEU-04 | Product editor: after the first save it jumps to "Variations & pricing" (`ProductForm.vue:43-50`), but **Cancel/Done exists only on the General tab** (`ProductGeneralTab.vue:136-141`). Runtime: the variations tab's only buttons were the tabs and the editor actions. General needs "Save" while variations and prices apply instantly | No visible exit from the editor. Mixed save models make users unsure what persisted | Add a persistent "Done" in the form header. State "Changes here save automatically" on the variations tab, or unify the save model |
| UX-29 | medium | SPEC-05, HEU-06 | `ClientSalesList.vue:20-28` lists sales by date only, with no tanda name or grouping `[S:08]`. The spec requires "their sales (per tanda)" | Hard to answer "what does Ana owe for the Weekend cakes tanda?" | Group by tanda (heading with name, date, and status), and add a per-sale "Record payment" action |
| UX-30 | medium | LAW-05, HEU-01, WIG-19 | `src/main.ts:12-25`: the app mounts only after `initDatabase()` (658 KB sql.js WASM plus IndexedDB). Until then `#app` is empty, and a rejected promise leaves a blank page with no message. Measured 350–500 ms locally with a warm cache. Cold mobile loads will be slower | A white screen on a slow phone or network. A storage failure (private mode, quota) looks like a crash | Render a static splash/skeleton in `index.html` and catch bootstrap errors with a readable message plus "Export/Reset" guidance |

### 3.4 Low

| ID | Sev | Rules | Evidence | User impact | Recommendation |
|---|---|---|---|---|---|
| UX-31 | low | WIG-07 | `SaleForm.vue:266-273`: "Add sale" stays disabled until a client and lines exist, so the explanatory errors at `SaleForm.vue:100-109` can never appear (runtime: disabled on open) | Users don't learn what is missing | Keep the button enabled and show the existing inline errors, or add a helper line ("Pick a client and add a product") |
| UX-32 | low | A11Y-06, WIG-15 | `StatusFlow.vue:61-75`: the action row doesn't wrap. "Advance to closed" overflows the card edge at 390px `[S:19]` | Clipped primary action on narrow phones | Let the actions `.row` wrap and stack full-width buttons on mobile |
| UX-33 | low | SPEC-04, LAW-03, LAW-06 | On mobile, three stat cards fill the first screen and "Next up" (the actionable item) starts below the fold `[S:14]`. Each card has an equal-weight ghost CTA | The most useful info (next tanda, its pending amount) needs a scroll | Put "Next up" first on mobile. Compact the stats into a 3-column row or a horizontal strip |
| UX-34 | low | HEU-02, WIG-20 | `.badge { text-transform: capitalize }` (`main.css:196`) rewrites user content: payment badge "Sale · Weekend **Cakes**" for a tanda named "Weekend cakes" `[S:08]`. `PricingSection.vue:80` turns "(3 options)" into "(3 Options)" `[S:03]` | User-entered names get altered; casing is inconsistent | Drop `capitalize` and capitalize enum labels in code |
| UX-35 | low | A11Y-01 | `ProductList.vue:61`, `ProductCard.vue:65`: thumbnail `alt` equals the product name, which is already shown next to it | Screen readers read the name twice | Use `alt=""` for thumbnails next to the visible name |
| UX-36 | low | WIG-08, A11Y-17 | Placeholders duplicate the labels or are vague ("Client name", "0.00", "—" in `PriceTable.vue:84`) and lack `…`. Variation and option inputs rely on placeholders as labels (see UX-06) | The hint disappears once the user types and gives no example | Follow "e.g. Coffee…" style placeholders and keep a real label |
| UX-37 | low | WIG-06 | Money inputs use `type="number" step="0.01"` with no `inputmode="decimal"` (`PaymentForm.vue:73-82`, `PriceTable.vue:78-83`, `ProductGeneralTab.vue:130`). Name inputs have no `name`/`autocomplete="off"` | Scroll-wheel changes, locale decimal issues, and password-manager prompts | Use `type="text" inputmode="decimal"` with parsing, and `autocomplete="off"` on non-auth fields |
| UX-38 | low | WIG-14, HEU-04 | No `<meta name="theme-color">` (runtime count 0, `index.html`). Scrim colors are hard-coded and differ (`ConfirmDialogHost.vue:39` 45% vs `SaleDialog.vue:55` 55%). The product hover shadow is hard-coded (`ProductCard.vue:255-258`) | The mobile browser chrome doesn't match the theme; small visual drift between overlays | Add `--color-scrim` and `--shadow-hover` tokens, and a theme-color meta updated by `applyTheme` |
| UX-39 | low | WIG-13 | Bottom nav, FAB, and bottom sheet ignore `env(safe-area-inset-bottom)`, and the viewport meta lacks `viewport-fit=cover` (`index.html`, `App.vue:140-151`, `SaleDialog.vue:100-111`) | On notched iPhones the nav can sit under the home indicator | Add `padding-bottom: env(safe-area-inset-bottom)` to the nav and sheet, and offset the FAB |
| UX-40 | low | WIG-21, LAW-01 | `src/shared/db/format.ts:7,16,29` hard-code the `'en-US'` locale. With MXN this renders "MX$" `[S:00]`, where Mexican users expect "$" | Unfamiliar currency notation for the main audience | Use `navigator.language` (or a locale setting next to Currency) |
| UX-41 | low | HEU-04, WIG-16 | The tandas table has no card wrapper while the products and clients tables do (`tandas/index.vue:89`). Clients money columns are left-aligned (`clients/index.vue:90-94`) while tandas money columns are right-aligned (`tandas/index.vue:113-117`) `[S:04]` | Lists feel inconsistent and amounts are harder to compare | Share one table component: card wrapper, right-aligned `tabular-nums` money |
| UX-42 | low | HEU-08 | The "Sales" tab plus an "Sales" `<h2>` directly below it (`tandas/[id].vue:63-72`, `SaleList.vue:48`), and the same with "Inventory" (`InventoryEditor.vue:49`) `[S:05]` | Redundant labels add noise | Drop the inner headings when inside a tab panel (keep them visually hidden for structure) |
| UX-43 | low | HEU-05 | "Advance to production" closes pre-orders for scheduled tandas with no confirmation (runtime: no dialog). It sits next to "← Back to …" (`StatusFlow.vue:41-45, 66-72`) | An accidental tap stops sales. Recoverable, but surprising | Show a confirmation, or an undo toast stating the consequence ("Pre-orders will close") |
| UX-44 | low | LAW-01, HEU-04 | The Clients FAB doesn't create anything; it only focuses the input at the top of the page (`clients/index.vue:69`, `34-36`) | The FAB's convention ("create") is half-honored | Open a small create sheet, or scroll to the input and highlight it |
| UX-45 | low | HEU-01 | `src/pages/index.vue:11`: `nextActions` is a one-time `slice`, not a `computed` | The dashboard list can go stale if the data changes while it is mounted (e.g. after an import) | Wrap it in `computed` |
| UX-46 | low | WIG-15 | The tanda name input is truncated on mobile ("Weekend cake") because it shares a row with the date (`TandaHeader.vue:58-61, 78-87`) `[S:15]` | The page subject is cut off | Stack the name above the date on mobile |
| UX-47 | low | LAW-06, HEU-08 | The inventory paints never-produced SKUs' "0 available" in danger red and renders empty product groups (`InventoryEditor.vue:87-89, 160-171`) `[S:07]` `[S:19]` | False alarms dilute the real "sold out" signal | Use red only for produced-then-sold-out SKUs, and hide unproduced SKUs and empty groups in the locked view |

### 3.5 Severity counts

| Critical | High | Medium | Low | Total |
|:-:|:-:|:-:|:-:|:-:|
| 1 | 7 | 22 | 17 | **47** |

### 3.6 Systemic patterns

- **No shared overlay or menu primitives.** Dialog, confirm, combobox, and kebab each re-implement open/close without focus management (UX-02, UX-03, UX-27). One accessible primitive would fix four components.
- **The token palette was tuned for looks, not contrast.** Soft-on-soft pairs (badges, hover states) and the border and focus tokens sit below the thresholds (UX-04, UX-05).
- **Labels are missing wherever inputs live in tables or rows** (UX-06).
- **Silence is the default outcome.** There is no status or toast layer (UX-19, UX-20).
- **Mapping logic is duplicated per file.** Status→badge maps and money-column alignment drift between screens (UX-25, UX-41).

---

## 4. Things done well

- **Coherent token system** (`main.css:1-52`) with a full dark theme that sets `color-scheme: dark`. Body text contrast is excellent (15.75:1 light, 13.46:1 dark). Muted text passes (6.36:1 / 5.34:1).
- **Sale composer craft:** 44px stepper buttons, Enter adds a line, focus returns to product search, and a sticky total footer (`SaleForm.vue:145-273`). Disabled SKU options carry reasons ("No price set"), as the spec asks.
- **Overlay engineering:** the combobox dropdown is teleported and flips to avoid clipping. Scroll lock is reference-counted (`useScrollLock.ts`). `overscroll-behavior: contain` is set on the sheet and lists.
- **Responsive switching works:** no horizontal overflow at 390px across 8 routes at default text size. Tables become cards, a bottom nav with icon **and** text labels, and a bottom sheet for sales.
- **Motion hygiene:** explicit transition properties (no `transition: all`) and `prefers-reduced-motion` honored where motion exists.
- **Money is formatted with `Intl.NumberFormat` and `tabular-nums`.** Long client names wrap (`overflow-wrap: anywhere`) instead of breaking the layout `[S:05]`.
- **Icon buttons have names** (kebab "Actions", steppers "One more Cake (…)", "Remove …", FAB labels), and nav uses real links with `aria-current`.
- **Helpful contextual copy:** status captions per tanda type (`StatusFlow.vue:13-26`), type helpers on creation, and pricing explanations.

---

## 5. Prioritized remediation plan

Effort: **S** ≤ 2 h · **M** ≈ ½–1 day · **L** ≈ 2–3 days.

### Quick wins (≈ 1–2 days total)

| Order | Items | Effort |
|---|---|:-:|
| 1 | UX-01: create a default SKU for products without variations, plus a migration and an e2e test | M |
| 2 | UX-04, UX-05: retune badge, border, and focus tokens to pass 4.5:1 and 3:1 in both themes | S |
| 3 | UX-07: focus-visible ring on the delivered toggle; UX-06: add `aria-label`s to row inputs | S |
| 4 | UX-22: hide "0 available" for scheduled tandas; UX-08: block Sell and stock entry for unpriced SKUs | S |
| 5 | UX-10: route titles; UX-11: page `<h1>`s; UX-12: skip link and focus on navigation | S |
| 6 | UX-15, UX-16: remove the duplicate mobile "New sale", show back only on detail routes; make "New tanda" open the form | S |
| 7 | UX-17, UX-18: a danger tone for destructive confirms, consequence copy, pre-checks before confirming | S |
| 8 | UX-14, UX-32, UX-39: FAB spacer, wrapping status actions, safe-area padding | S |
| 9 | UX-25, UX-34, UX-41: centralize badge maps, drop `capitalize`, unify tables | S |

### Larger work

| Order | Items | Effort |
|---|---|:-:|
| 10 | UX-02, UX-27: one accessible `Dialog` (native `<dialog>`/focus trap, Escape, restore) and `Menu` primitive | M |
| 11 | UX-03: rebuild the Combobox on the ARIA 1.2 pattern with keyboard navigation and tests | M |
| 12 | UX-19, UX-20, UX-31: a toast/status service with `aria-live`, field-linked errors, enabled-with-errors submit | M |
| 13 | UX-24, UX-28: draft protection in the sale sheet; a "Done" exit and a single save model in the product editor | M |
| 14 | UX-26: accessible tabs synced to `?tab=` | S–M |
| 15 | UX-29: client sales grouped per tanda, with a per-sale "Record payment" | M |
| 16 | UX-09, UX-13: large-text and coarse-pointer pass (44px targets, nav min-height, wrapping headers) | M |
| 17 | UX-30: boot splash and error screen in `index.html` | S |

---

## 6. Limits of this audit

- Contrast was computed from tokens, not sampled from pixels. Disabled controls (exempt under 1.4.3) were noted but not counted as failures.
- 200% text was simulated by raising the root font size, not by the browser's zoom or OS text-size setting. Results should be confirmed on a device.
- No screen reader (NVDA, VoiceOver) or real touch device was used. Announcements were inferred from the markup and the runtime DOM probes listed above.
- Load timing was measured locally with a warm cache. Cold, throttled mobile performance (LCP/INP) was not profiled.
- Settings import/export and currency switching were reviewed in code only and not exercised end to end.
