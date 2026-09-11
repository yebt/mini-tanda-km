import { expect, test } from '@playwright/test'

test('full journey: product priced by one variation → client → scheduled tanda → sale', async ({
  page,
}) => {
  await page.goto('/')

  // ── Product priced by SIZE only ────────────────────────────────────────
  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByRole('button', { name: 'New product' }).click()
  await page.locator('#product-name').fill('Cake')
  await page.getByRole('radio', { name: /Price per SKU/i }).check()
  await page.locator('button[type="submit"].btn-primary').click()

  // Landed on the Variations & pricing tab: add SIZE with two options.
  await page.getByPlaceholder('New variation, e.g. SIZE').fill('SIZE')
  await page.getByRole('button', { name: 'Add variation' }).click()
  const sizeEditor = page.locator('.card', { hasText: 'SIZE' }).last()
  await sizeEditor.getByPlaceholder('New option, e.g. Coffee').fill('Personal')
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
  await sizeEditor.getByPlaceholder('New option, e.g. Coffee').fill('Family')
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
  await expect(page.getByRole('button', { name: 'Remove Personal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Family' })).toBeVisible()

  // Price depends on SIZE only — one price per size covers every future flavor.
  await page.getByRole('checkbox', { name: /SIZE/ }).check()
  const personalRow = page.locator('tr', { hasText: 'Personal' })
  await personalRow.locator('input.price-input').fill('90')
  await personalRow.locator('input.price-input').press('Tab')
  await expect(personalRow.locator('.no-price')).toHaveCount(0)

  // ── Client ─────────────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Clients' }).click()
  await page.getByPlaceholder('Client name').fill('María')
  await page.getByRole('button', { name: 'Add client' }).click()
  await expect(page.getByText('María').first()).toBeVisible()

  // ── Scheduled tanda with a sale ────────────────────────────────────────
  await page.getByRole('link', { name: 'Tandas' }).click()
  await page.getByRole('button', { name: 'New tanda' }).click()
  await expect(page.locator('#tanda-name')).toHaveValue(/^Tanda /)
  await page.getByRole('button', { name: 'Create tanda' }).click()

  // Landed on the tanda detail page.
  await expect(page.getByText('open', { exact: false }).first()).toBeVisible()

  await page.locator('#sale-client').selectOption({ label: 'María' })
  const skuSelect = page.locator('#sale-sku')
  const personalValue = await skuSelect
    .locator('option', { hasText: 'Personal' })
    .first()
    .getAttribute('value')
  await skuSelect.selectOption(personalValue!)
  await page.getByLabel('Quantity').fill('3')
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.getByRole('button', { name: 'Add sale' }).click()

  // 3 × $90 (SIZE-only pricing) = $270 pending.
  await expect(page.getByText('270.00').first()).toBeVisible()
  await expect(page.getByText('Pending').first()).toBeVisible()

  // Status moves forward, and can move back with a confirmation.
  await page.getByRole('button', { name: 'Advance to production' }).click()
  await expect(page.getByText('production').first()).toBeVisible()
  await page.getByRole('button', { name: /Back to open/ }).click()
  await page.getByRole('button', { name: 'Move back' }).click()
  await expect(page.getByRole('button', { name: 'Advance to production' })).toBeVisible()
})

test('anticipated tanda: stock in open, sales open once ready', async ({ page }) => {
  await page.goto('/')

  // ── Priced product ─────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByRole('button', { name: 'New product' }).click()
  await page.locator('#product-name').fill('Cookie')
  await page.getByRole('radio', { name: /Price per SKU/i }).check()
  await page.locator('button[type="submit"].btn-primary').click()

  await page.getByPlaceholder('New variation, e.g. SIZE').fill('SIZE')
  await page.getByRole('button', { name: 'Add variation' }).click()
  const sizeEditor = page.locator('.card', { hasText: 'SIZE' }).last()
  await sizeEditor.getByPlaceholder('New option, e.g. Coffee').fill('Big')
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
  await page.getByRole('checkbox', { name: /SIZE/ }).check()
  const bigRow = page.locator('tr', { hasText: 'Big' })
  await bigRow.locator('input.price-input').fill('50')
  await bigRow.locator('input.price-input').press('Tab')

  // ── Client ─────────────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Clients' }).click()
  await page.getByPlaceholder('Client name').fill('Ana')
  await page.getByRole('button', { name: 'Add client' }).click()

  // ── Anticipated tanda: no sales while open/production ──────────────────
  await page.getByRole('link', { name: 'Tandas' }).click()
  await page.getByRole('button', { name: 'New tanda' }).click()
  await page.locator('#tanda-type').selectOption('anticipated')
  await page.getByRole('button', { name: 'Create tanda' }).click()

  await expect(page.getByText('Define the batch inventory')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'New sale' })).toHaveCount(0)

  // Register production: 5 Big cookies.
  const inventorySection = page.locator('section', {
    has: page.getByRole('heading', { name: 'Inventory' }),
  })
  const bigInventoryRow = inventorySection.locator('tr', { hasText: 'Big' })
  await bigInventoryRow.locator('input.qty-input').fill('5')
  await bigInventoryRow.locator('input.qty-input').press('Tab')

  await page.getByRole('button', { name: 'Advance to production' }).click()
  await expect(page.getByText('Baking is underway')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'New sale' })).toHaveCount(0)

  // ── Sales open once ready ──────────────────────────────────────────────
  await page.getByRole('button', { name: 'Advance to ready' }).click()
  await expect(page.getByText('Sales are open against the batch inventory')).toBeVisible()

  await page.locator('#sale-client').selectOption({ label: 'Ana' })
  const skuSelect = page.locator('#sale-sku')
  const bigValue = await skuSelect.locator('option', { hasText: 'Big' }).first().getAttribute('value')
  await skuSelect.selectOption(bigValue!)
  await page.getByLabel('Quantity').fill('2')
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.getByRole('button', { name: 'Add sale' }).click()

  // 2 × $50 = $100 pending; stock drops to 3 available.
  await expect(page.getByText('100.00').first()).toBeVisible()
  await expect(bigInventoryRow.locator('td.col-num')).toHaveText(['5', '2', '3'])
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

  // No back button on the dashboard; appears deeper in the stack.
  await expect(page.locator('.back-btn')).toHaveCount(0)
  await bottomNav.getByRole('link', { name: /Products/i }).click()
  await expect(page.locator('.back-btn')).toBeVisible()

  // Floating action button creates a product on mobile.
  await page.locator('.fab').click()
  await expect(page.locator('#product-name')).toBeVisible()

  // Currency setting switches formatting app-wide.
  await bottomNav.getByRole('link', { name: /Settings/i }).click()
  await page.locator('select').selectOption('USD')
  await expect(page.getByText('Sample: $1,234.50')).toBeVisible()

  // Lists render as cards/lists on mobile — no horizontal overflow.
  const assertNoOverflow = async () => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(390)
  }

  await bottomNav.getByRole('link', { name: /Clients/i }).click()
  await page.getByPlaceholder('Client name').fill('Luna')
  await page.locator('form').getByRole('button', { name: 'Add client' }).click()
  await expect(page.locator('.client-item')).toBeVisible()
  await assertNoOverflow()

  await bottomNav.getByRole('link', { name: /Tandas/i }).click()
  await page.locator('.fab').click()
  await page.getByRole('button', { name: 'Create tanda' }).click()
  // Creating navigates to the detail page; go back to see the list card.
  await page.locator('.back-btn').click()
  await expect(page.locator('.tanda-card')).toBeVisible()
  await assertNoOverflow()
})
