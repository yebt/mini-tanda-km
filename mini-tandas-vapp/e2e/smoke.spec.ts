import { expect, test } from '@playwright/test'

test('full journey: product with variations → client → scheduled tanda → sale', async ({ page }) => {
  await page.goto('/')

  // ── Product with a SIZE variation ──────────────────────────────────────
  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByRole('button', { name: 'New product' }).click()
  await page.locator('#product-name').fill('Cake')
  await page.locator('#product-price').fill('100')
  await page.locator('button[type="submit"].btn-primary').click()

  // The form stays open after create so variations can be added immediately.
  await page.getByPlaceholder('New variation, e.g. SIZE').fill('SIZE')
  await page.getByRole('button', { name: 'Add variation' }).click()
  const sizeEditor = page.locator('.card', { hasText: 'SIZE' }).last()
  await sizeEditor.getByPlaceholder('New option, e.g. Coffee').fill('Personal')
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
  await sizeEditor.getByPlaceholder('New option, e.g. Coffee').fill('Family')
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
  await expect(page.getByRole('button', { name: 'Remove Personal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Family' })).toBeVisible()

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
  const personalValue = await skuSelect.locator('option', { hasText: 'Personal' }).first().getAttribute('value')
  await skuSelect.selectOption(personalValue!)
  await page.getByLabel('Quantity').fill('3')
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.getByRole('button', { name: 'Add sale' }).click()

  // 3 × $100 = $300 pending.
  await expect(page.getByText('300.00').first()).toBeVisible()
  await expect(page.getByText('Pending').first()).toBeVisible()
})
