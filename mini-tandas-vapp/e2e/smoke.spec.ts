import { expect, test } from '@playwright/test'

test('full journey: product priced by one variation → client → scheduled tanda → sale', async ({
  page,
}) => {
  await page.goto('/')

  // ── Product priced by SIZE only ────────────────────────────────────────
  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.getByRole('link', { name: 'New product' }).click()
  await page.locator('#product-name').fill('Cake')
  await page.getByRole('radio', { name: /Price per SKU/i }).check()
  await page.locator('button[type="submit"].btn-primary').click()

  // Landed on the Variations & pricing tab: add SIZE with two options.
  await page.getByLabel('New variation name').fill('SIZE')
  await page.getByRole('button', { name: 'Add variation' }).click()
  const sizeEditor = page.locator('.card', { hasText: 'SIZE' }).last()
  await page.getByLabel('New option for SIZE').fill('Personal')
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
  await sizeEditor.getByPlaceholder('e.g. Coffee…').fill('Family')
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
  await expect(page.getByRole('button', { name: 'Remove Personal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Family' })).toBeVisible()

  // Price depends on SIZE only — one price per size covers every future flavor.
  await page.getByRole('checkbox', { name: /SIZE/ }).check()
  const personalRow = page.locator('tr', { hasText: 'Personal' })
  await page.getByLabel('Price for Personal').fill('90')
  await page.getByLabel('Price for Personal').press('Tab')
  await expect(personalRow.locator('.no-price')).toHaveCount(0)

  // ── Client ─────────────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Clients', exact: true }).click()
  await page.getByRole('textbox', { name: 'New client' }).fill('María')
  await page.getByRole('button', { name: 'Add client' }).click()
  // The outcome is confirmed in a polite status region.
  await expect(page.getByRole('status')).toContainText('Client "María" added.')
  await expect(page.getByText('María').first()).toBeVisible()

  // ── Scheduled tanda with a sale ────────────────────────────────────────
  await page.getByRole('link', { name: 'Tandas', exact: true }).click()
  await page.getByRole('button', { name: 'New tanda' }).click()
  await expect(page.locator('#tanda-name')).toHaveValue(/^Tanda /)
  await page.getByRole('button', { name: 'Create tanda' }).click()
  await expect(page.getByLabel('Tanda name')).toHaveValue(/^Tanda /)
  await expect(page.getByLabel('Tanda date')).toBeVisible()

  // Landed on the tanda detail page; sales are open while scheduled+open.
  await expect(page.getByText('open', { exact: false }).first()).toBeVisible()

  await page.getByRole('button', { name: 'New sale' }).click()
  await page.locator('#sale-client').fill('Marí')
  await page.getByRole('option', { name: 'María' }).click()
  await page.locator('#sale-sku').fill('Personal')
  await page.getByRole('option', { name: /Cake \(Personal\)/ }).click()
  await page.getByLabel('Quantity').fill('3')
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.getByRole('button', { name: 'Add sale' }).click()

  // 3 × $90 (SIZE-only pricing) = $270 pending.
  await expect(page.getByText('270.00').first()).toBeVisible()
  await expect(page.getByText('Pending').first()).toBeVisible()

  // Status moves forward (closing pre-orders asks first), and can move back with a confirmation.
  await page.getByRole('button', { name: 'Advance to production' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Pre-orders will close')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Advance to production' }).click()
  await expect(page.getByText('production').first()).toBeVisible()
  await page.getByRole('button', { name: /Back to open/ }).click()
  await page.getByRole('button', { name: 'Move back' }).click()
  await expect(page.getByRole('button', { name: 'Advance to production' })).toBeVisible()
})

test('anticipated tanda: stock in open, sales open once ready', async ({ page }) => {
  await page.goto('/')

  // ── Priced product ─────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.getByRole('link', { name: 'New product' }).click()
  await page.locator('#product-name').fill('Cookie')
  await page.getByRole('radio', { name: /Price per SKU/i }).check()
  await page.locator('button[type="submit"].btn-primary').click()

  await page.getByLabel('New variation name').fill('SIZE')
  await page.getByRole('button', { name: 'Add variation' }).click()
  const sizeEditor = page.locator('.card', { hasText: 'SIZE' }).last()
  await sizeEditor.getByPlaceholder('e.g. Coffee…').fill('Big')
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
  await page.getByRole('checkbox', { name: /SIZE/ }).check()
  const bigRow = page.locator('tr', { hasText: 'Big' })
  await bigRow.locator('input.price-input').fill('50')
  await bigRow.locator('input.price-input').press('Tab')

  // ── Client ─────────────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Clients', exact: true }).click()
  await page.getByRole('textbox', { name: 'New client' }).fill('Ana')
  await page.getByRole('button', { name: 'Add client' }).click()

  // ── Anticipated tanda: no sales while open/production ──────────────────
  await page.getByRole('link', { name: 'Tandas', exact: true }).click()
  await page.getByRole('button', { name: 'New tanda' }).click()
  await page.locator('#tanda-type').selectOption('anticipated')
  await page.getByRole('button', { name: 'Create tanda' }).click()

  await expect(page.getByText('Define the batch inventory')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New sale' })).toHaveCount(0)

  // Register production: 5 Big cookies (inventory lives on its own tab).
  await page.getByRole('tab', { name: 'Inventory' }).click()
  const inventorySection = page.locator('section', {
    has: page.getByRole('heading', { name: 'Inventory' }),
  })
  const bigInventoryRow = inventorySection.locator('tr', { hasText: 'Big' })
  await inventorySection.locator('table').getByLabel('Produced — Cookie (Big)').fill('5')
  await inventorySection.locator('table').getByLabel('Produced — Cookie (Big)').press('Tab')

  await page.getByRole('button', { name: 'Advance to production' }).click()
  await expect(page.getByText('Baking is underway')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New sale' })).toHaveCount(0)

  // ── Sales open once ready ──────────────────────────────────────────────
  await page.getByRole('button', { name: 'Advance to ready' }).click()
  await expect(page.getByText('Sales are open against the batch inventory')).toBeVisible()

  // Sell straight from the inventory: opens the sale dialog with the SKU picked.
  await bigInventoryRow.getByRole('button', { name: 'Sell' }).click()
  await expect(page.locator('#sale-sku')).toHaveValue('Cookie (Big)')

  await page.locator('#sale-client').fill('An')
  await page.getByRole('option', { name: 'Ana' }).click()
  await page.getByLabel('Quantity').fill('2')
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.getByRole('button', { name: 'Add sale' }).click()

  // 2 × $50 = $100 pending; stock drops to 3 available.
  await expect(bigInventoryRow.locator('td.col-num')).toHaveText(['5', '2', '3'])
  await page.getByRole('tab', { name: 'Sales' }).click()
  await expect(page.getByText('100.00').first()).toBeVisible()
})

test('product without variations: one global price, stocked and sold', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.getByRole('link', { name: 'New product' }).click()
  await page.locator('#product-name').fill('Cookies box')
  await page.locator('#product-price').fill('120')
  await page.locator('button[type="submit"].btn-primary').click()

  await page.getByRole('link', { name: 'Clients', exact: true }).click()
  await page.getByRole('textbox', { name: 'New client' }).fill('Ana')
  await page.getByRole('button', { name: 'Add client' }).click()

  await page.getByRole('link', { name: 'Tandas', exact: true }).click()
  await page.getByRole('button', { name: 'New tanda' }).click()
  await page.locator('#tanda-type').selectOption('anticipated')
  await page.getByRole('button', { name: 'Create tanda' }).click()

  // The single default SKU can be stocked…
  await page.getByRole('tab', { name: 'Inventory' }).click()
  const inventorySection = page.locator('section', {
    has: page.getByRole('heading', { name: 'Inventory' }),
  })
  const produced = inventorySection.locator('table').getByLabel('Produced — Cookies box')
  await produced.fill('4')
  await produced.press('Tab')
  await page.getByRole('button', { name: 'Advance to production' }).click()
  await page.getByRole('button', { name: 'Advance to ready' }).click()

  // …and sold from the sale picker at the global price.
  await page.getByRole('tab', { name: 'Sales' }).click()
  await page.getByRole('button', { name: 'New sale' }).click()
  await page.locator('#sale-client').fill('An')
  await page.getByRole('option', { name: 'Ana' }).click()
  await page.locator('#sale-sku').fill('Cookies')
  await page.getByRole('option', { name: /Cookies box/ }).click()
  await page.getByLabel('Quantity').fill('2')
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.getByRole('button', { name: 'Add sale' }).click()
  await expect(page.getByText('240.00').first()).toBeVisible()
})

test('mobile shell: bottom nav, back button and floating create button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  // Static bottom navbar with the five sections.
  const bottomNav = page.locator('.bottom-nav')
  await expect(bottomNav).toBeVisible()
  for (const section of ['Dashboard', 'Tandas', 'Products', 'Clients', 'Settings']) {
    await expect(bottomNav.getByRole('link', { name: new RegExp(section, 'i') })).toBeVisible()
  }

  // No back button on top-level sections; only detail pages get one.
  await expect(page.locator('.back-btn')).toHaveCount(0)
  await expect(page).toHaveTitle('Dashboard · Mini Tanda')
  await bottomNav.getByRole('link', { name: /Products/i }).click()
  await expect(page).toHaveTitle('Products · Mini Tanda')
  await expect(page.locator('.back-btn')).toHaveCount(0)
  // Focus moves to the new view's heading after navigating.
  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeFocused()

  // Floating action button: a drawn icon (not a text glyph), centered in the circle.
  const fab = await page.locator('.fab').evaluate((button) => {
    const outer = button.getBoundingClientRect()
    const icon = button.querySelector('svg')?.getBoundingClientRect()
    return {
      text: button.textContent?.trim(),
      dx: icon ? Math.abs(icon.left + icon.width / 2 - (outer.left + outer.width / 2)) : Infinity,
      dy: icon ? Math.abs(icon.top + icon.height / 2 - (outer.top + outer.height / 2)) : Infinity,
    }
  })
  expect(fab.text).toBe('')
  expect(fab.dx).toBeLessThanOrEqual(0.5)
  expect(fab.dy).toBeLessThanOrEqual(0.5)
  await expect(page.locator('.fab')).toHaveAccessibleName('New product')

  // Floating action button creates a product on mobile.
  await page.locator('.fab').click()
  await expect(page.locator('#product-name')).toBeVisible()

  // Currency setting switches formatting app-wide.
  await bottomNav.getByRole('link', { name: /Settings/i }).click()
  await page.locator('#currency-select').selectOption('USD')
  await expect(page.getByText('Sample: $1,234.50')).toBeVisible()

  // Lists render as cards/lists on mobile — no horizontal overflow.
  const assertNoOverflow = async () => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(390)
  }

  await bottomNav.getByRole('link', { name: /Clients/i }).click()
  // The Clients FAB brings the create field into view and focuses it.
  await page.getByRole('button', { name: 'New client' }).click()
  await expect(page.getByRole('textbox', { name: 'New client' })).toBeFocused()
  await page.getByRole('textbox', { name: 'New client' }).fill('Luna')
  await page.locator('form').getByRole('button', { name: 'Add client' }).click()
  await expect(page.locator('.client-item')).toBeVisible()
  await assertNoOverflow()

  await bottomNav.getByRole('link', { name: /Tandas/i }).click()
  await page.locator('.fab').click()
  await page.getByRole('button', { name: 'Create tanda' }).click()
  // Creating navigates to the detail page; go back to see the list card.
  await expect(page.locator('.back-btn')).toBeVisible()
  await page.locator('.back-btn').click()
  await expect(page.locator('.tanda-card')).toBeVisible()
  await assertNoOverflow()
})

test('tanda detail: titled, tab kept in the URL, back works from a deep link', async ({
  page,
}) => {
  await page.goto('/')

  // Skip link jumps over the header to the main content.
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()

  await page.getByRole('link', { name: 'Tandas', exact: true }).click()
  await page.getByRole('button', { name: 'New tanda' }).click()
  await page.locator('#tanda-name').fill('Weekend cakes')
  await page.locator('#tanda-type').selectOption('anticipated')
  await page.getByRole('button', { name: 'Create tanda' }).click()

  await expect(page).toHaveTitle('Weekend cakes · Tandas · Mini Tanda')
  // The open tanda's editable name is still the page heading.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)

  const inventoryTab = page.getByRole('tab', { name: 'Inventory' })
  await page.getByRole('tab', { name: 'Sales' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(inventoryTab).toBeFocused()
  await expect(inventoryTab).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/\?tab=inventory$/)
  await expect(page.getByRole('tabpanel', { name: 'Inventory' })).toBeVisible()

  // Reload (once the debounced save has landed) keeps the Inventory view.
  await expect(async () => {
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Inventory' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 1000 },
    )
  }).toPass()

  // Opened as a deep link on mobile: back goes to the list, not out of the app.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(page.url())
  await page.locator('.back-btn').click()
  await expect(page).toHaveURL(/\/tandas$/)
})

test('mobile: New tanda opens the form, one New sale, large text reflows, FAB leaves room', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  // Dashboard "New tanda" lands on the open creation form.
  await page.getByRole('link', { name: 'New tanda' }).click()
  await expect(page.locator('#tanda-name')).toBeVisible()
  await expect(page).toHaveURL(/\/tandas$/)
  await page.getByRole('button', { name: 'Create tanda' }).click()

  // Only the FAB offers "New sale" on mobile.
  await expect(page.getByRole('button', { name: 'Advance to production' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New sale' })).toHaveCount(1)

  // The FAB never covers content: main reserves room below the last row.
  const room = await page.evaluate(() => {
    const fab = document.querySelector('.fab')!.getBoundingClientRect()
    const padding = parseFloat(getComputedStyle(document.querySelector('main')!).paddingBottom)
    return { fabReach: window.innerHeight - fab.top, padding }
  })
  expect(room.padding).toBeGreaterThanOrEqual(room.fabReach)

  // 200% text: no horizontal scroll, nav links keep their names.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(390)
  await expect(
    page.locator('.bottom-nav').getByRole('link', { name: 'Settings' }),
  ).toBeVisible()
})

test('boot: a storage/WASM failure shows a readable error instead of a blank page', async ({
  page,
}) => {
  await page.route('**/*.wasm', (route) => route.abort())
  await page.goto('/')
  const alert = page.getByRole('alert')
  await expect(alert.getByRole('heading', { name: 'Mini Tanda could not start' })).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Reload' })).toBeFocused()
  await expect(page.locator('.boot-splash')).toHaveCount(0)
})
