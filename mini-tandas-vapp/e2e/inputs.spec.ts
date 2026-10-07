import { expect, test } from '@playwright/test'

/** Fields that take typed text (radios, checkboxes and file pickers do not trigger the zoom). */
const TEXT_FIELD =
  'input:not([type="file"]):not([type="radio"]):not([type="checkbox"]):not([type="hidden"])'

/** Computed font-size (px) of every form control matched by `selector`. */
async function fontSizes(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => parseFloat(getComputedStyle(element).fontSize)),
  )
}

// iOS Safari zooms into any focused field under 16px; keep every control at 16px or more on phones.
test('mobile: form controls use at least 16px text', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/products/new')
  await expect(page.locator('#product-name')).toBeVisible()
  for (const size of await fontSizes(page, `${TEXT_FIELD}, select, textarea`)) {
    expect(size).toBeGreaterThanOrEqual(16)
  }

  // Seed what the sale sheet needs: a priced product, then an open tanda.
  await page.locator('#product-name').fill('Bread')
  await page.locator('#product-price').fill('30')
  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page).toHaveURL(/\/products\/[^/?]+/)
  await page.goto('/tandas?new=1')
  await page.getByRole('button', { name: 'Create tanda' }).click()
  await expect(page).toHaveURL(/\/tandas\/[^/?]+/)
  for (const size of await fontSizes(page, `${TEXT_FIELD}, select`)) {
    expect(size).toBeGreaterThanOrEqual(16)
  }

  // Sale sheet: client and product comboboxes and the quantity stepper.
  await page.locator('.fab').click()
  await expect(page.locator('#sale-client')).toBeVisible()
  const sheetSizes = await fontSizes(page, `[role="dialog"] ${TEXT_FIELD}`)
  expect(sheetSizes.length).toBeGreaterThanOrEqual(3)
  for (const size of sheetSizes) expect(size).toBeGreaterThanOrEqual(16)
})
