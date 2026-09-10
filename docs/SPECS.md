# MINI TANDA

> Build decisions (agreed 2026-09-10): storage = SQLite (WASM, persisted in the browser); UI language = English; payments = general client ledger **and** per-sale payments with a combined balance; scope = full app in one build.

## Product

I have products with: name, optional description, photo.

Each product may or may not have N variations.

Example — Cake:

- variation: FLAVOR
  - COFFEE
  - Chocolate
  - RED VELVET
- variation: SIZE
  - Personal
  - Family

### Price

The price can be:

- **global**: one price for the whole product.
- **depending on one or more variations**: meaning one price is set per SKU (per combination of variation options).

For products without variations, there is only one price.

---

## Tanda

Once products are created, I can create tandas (batches).

A tanda has a name (the date for the tanda can be set automatically) and a status.

A tanda can be of 2 types: **scheduled** and **anticipated**.

### Scheduled

It is when I schedule a future date and start receiving pre-orders.
Each pre-order is a sale.

In other words, sales happen **pre-production**.

Each sale consists of:

- A client (who can be created on the spot if they don't exist yet).
- A payment status (paid or not).
- A delivery status — it becomes enabled for marking as delivered when the tanda passes from *production* to *ready*. It exists to know whether I already delivered the product.
- The products associated with that sale, from which the amount is calculated. Example: 3 personal red velvet cakes and one large chocolate one for the same person.

### Anticipated

It is when I make (or generate) a fixed quantity of products, and then each sale is made against the inventory associated with that batch.

In other words, sales happen **post-production**.

I should not be able to sell more than what I produced.

Each inventory depends on the combination of SKUs added to it. Example — I produced:

- 4 small red velvets
- 4 large red velvets
- 2 small chocolates

So I cannot sell 1 large chocolate: I don't have it for this tanda.

---

## Client

I can visit a client and make payments (abonos) toward what they owe in general.

- Client: only the name.
