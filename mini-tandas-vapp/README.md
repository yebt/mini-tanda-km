# Mini Tanda

Batch (tanda) sales manager for a small bakery. Create products with variation-based SKUs and flexible pricing, run **scheduled** tandas (pre-orders before production) or **anticipated** tandas (sell only what you produced), and track clients, payments (per-sale or general abonos), and deliveries.

- **Vue 3** + TypeScript (`<script setup>`), Pinia, vue-router (file-based routes)
- **SQLite in the browser** via sql.js (WASM), persisted to IndexedDB — no backend
- Spec: [`../docs/SPECS.md`](../docs/SPECS.md)

## Commands

```sh
bun install          # install dependencies
bun dev              # dev server
bun run build        # type-check + production build
bun test:unit        # vitest domain tests
bun test:e2e         # playwright (needs `bunx playwright install chromium`)
bun lint             # oxlint + eslint
bun format           # oxfmt
```

## Structure

```
src/
  core/          app shell, router
  pages/         route pages (dashboard, products, tandas, clients)
  features/      feature components (products/ tandas/ clients/)
  shared/
    db/          sql.js database, schema, repositories, domain types
    stores/      Pinia stores (products, tandas, clients)
    assets/      design tokens + global CSS classes
```
