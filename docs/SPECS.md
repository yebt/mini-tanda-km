# MINI TANDA

> Build decisions (agreed 2026-09-10): storage = SQLite (WASM, persisted in the browser via IndexedDB); UI language = English; payments = general client ledger **and** per-sale payments with a combined balance; scope = full app in one build.
> Stack: Vue 3 (`<script setup>` + TypeScript), Pinia, sql.js, Vue Router, Lucide icons, Vite. Unit tests (Vitest) + e2e (Playwright, headless by default).

## Product

I have products with: name, optional description, photo.

Each product may or may not have N variations (e.g. FLAVOR: Coffee, Chocolate, Red Velvet; SIZE: Personal, Family). Variations and their options are managed in a dedicated **Variations** tab, separate from the product's general settings tab. The full cartesian combination of options forms the product's SKUs.

### Price

The price can be:

- **global**: one price for the whole product.
- **per SKU**: one price per combination of variation options — but the price may depend on **one variation, two, or all of them**. The product defines which variation(s) drive pricing; a price is set per combination of options of those variations only, and it covers every combination of the remaining variations.
  - Example: for cakes the price depends on SIZE only (one price per size covers every flavor). Another product could price by SIZE and PACKAGING, but not by FLAVOR.

A SKU without a resolved price cannot be sold. For products without variations there is a single price.

Products with any sale cannot be deleted.

---

## Tanda

Once products are created, I can create tandas (batches).

A tanda has a name (prefilled with the date, editable), a date, a type, and a status.

Status flow: **open → production → ready → closed**. I can move a tanda forward, and also **move it back** if I made a mistake (with a confirmation). What each status means depends on the tanda type:

### Scheduled

I schedule a future date and start receiving pre-orders **while the tanda is open**. Each pre-order is a sale, made **pre-production** — there is no inventory; sales are only limited by the SKUs having a price. Once the tanda leaves `open`, sales are closed.

### Anticipated

I make a fixed quantity of products **before** selling; each sale is made against the inventory of that batch (**post-production**).

- Inventory is tracked per SKU: **produced / sold / available**. I can only sell what was produced for this tanda — not more, and only SKUs that were produced at all.
- Selling is enabled once the tanda reaches `ready` (production done). From the inventory view I can tap a SKU's **Sell** action to open the sale dialog with that SKU pre-selected.
- Sales cannot exceed available stock; editing a sale re-checks stock after giving the sale's own quantities back, so keeping or shrinking lines never fails against itself.

---

## Sale

A sale consists of:

- A **client** (searchable autocomplete; created on the spot if they don't exist yet).
- **Items**: N × SKU lines merged by SKU, each with a snapshot `unit_price` taken at creation.
- A **payment status**: derived — total minus payments allocated to the sale (Pending badge with balance, or Paid).
- A **delivery status** (delivered or not) — marking delivery is only enabled once the tanda passes from *production* to *ready*.

Sales are created from the tanda's **Sales** tab (modal on desktop, bottom sheet on mobile). Product and client pickers are autocomplete comboboxes; SKUs without price or without stock show **disabled in gray** with the reason.

### Editing a sale

An existing sale can be edited (kebab → Edit): add the product that was missing, remove lines, or change quantities. The client cannot be changed (payments are tied to it). Lines that already existed **keep their original unit price** — an edit never reprices the sale; only newly added SKUs resolve the current price. An edit cannot leave the sale empty.

### Deleting a sale

Deletes the sale and its items. Payments made toward it are **not lost** — they become general client payments (abonos), so the client's balance keeps the credit.

---

## Client

Clients have only a name.

- From the client page I can record **payments**: either toward a specific sale (dropdown, prefilled via "Record payment" on a sale card) or as a general abono. The client's balance combines both.
- The client page shows their sales (per tanda) and payments history.
- A client that has any sale or payment **cannot be deleted** (the option is shown but fails with an explanatory message).

---

## Dashboard

Home shows summary cards: active tandas, products, amount owed by clients, and the **next tanda** with its status and pending amount.

---

## Settings

- **Currency**: choose the display currency; formatting applies app-wide.
- **Theme**: light / dark mode.
- **Data export**: download the entire database as a JSON file.
- **Data import**: restore from a JSON file — replaces **all** current data (asked for confirmation first).

---

## Platform & UI behavior

- **Responsive**: on desktop, lists render as tables with row actions under a kebab (⋯) dropdown menu. On mobile (≤720px) lists render as cards, the top navbar is replaced by a static **bottom navigation**, deeper pages get a **back button**, and creation actions become a floating action button (FAB).
- **Dialogs**: sale form and confirmations are internal components (never the native `confirm`). While a dialog is open, background scroll is locked (restored when the last dialog closes), and autocomplete dropdowns are rendered as overlays so they are never clipped by the dialog.
- **Sale lines UX**: quantity stepper (−/+), Enter adds a line, focus returns to the product search after each line, and the total footer stays visible while the sheet scrolls.
