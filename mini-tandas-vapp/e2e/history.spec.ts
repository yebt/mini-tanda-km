import { expect, test, type Page } from '@playwright/test'

/** A priced product, a client and an open scheduled tanda (sales open). */
async function seedOpenTanda(page: Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.getByRole('link', { name: 'New product' }).click()
  await page.locator('#product-name').fill('Bread')
  await page.locator('#product-price').fill('30')
  await page.locator('button[type="submit"].btn-primary').click()

  await page.getByRole('link', { name: 'Clients', exact: true }).click()
  await page.getByRole('textbox', { name: 'New client' }).fill('Ana')
  await page.getByRole('button', { name: 'Add client' }).click()

  await page.getByRole('link', { name: 'Tandas', exact: true }).click()
  await page.getByRole('button', { name: 'New tanda' }).click()
  await page.getByRole('button', { name: 'Create tanda' }).click()
  await expect(page).toHaveURL(/\/tandas\/[^/?]+/)
}

test('sale sheet: Back closes it and asks before discarding drafted lines', async ({ page }) => {
  await seedOpenTanda(page)
  const tandaUrl = page.url()
  const sheet = page.getByRole('dialog')

  // Empty draft: Back just closes the sheet and stays on the tanda.
  await page.getByRole('button', { name: 'New sale' }).click()
  await expect(sheet).toBeVisible()
  await page.goBack()
  await expect(sheet).toHaveCount(0)
  await expect(page).toHaveURL(tandaUrl)

  // With a line: Back asks first; Cancel keeps the sheet and the line.
  await page.getByRole('button', { name: 'New sale' }).click()
  await page.locator('#sale-sku').fill('Bread')
  await page.getByRole('option', { name: /Bread/ }).click()
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.goBack()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Discard this sale?')
  // A second Back while asking does not leave the tanda (route-leave guard).
  await page.goBack()
  await expect(page).toHaveURL(tandaUrl)
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Bread').first()).toBeVisible()
  await expect(page).toHaveURL(tandaUrl)

  // Back again asks again; Discard closes the sheet, still on the tanda.
  await page.goBack()
  await confirm.getByRole('button', { name: 'Discard' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page).toHaveURL(tandaUrl)

  // The sheet left no stray entry behind: the next Back leaves the tanda.
  await page.goBack()
  await expect(page).toHaveURL(/\/tandas(\?[^/]*)?$/)
})

test('sale sheet: closing with × leaves no extra history entry', async ({ page }) => {
  await seedOpenTanda(page)
  await page.getByRole('button', { name: 'New sale' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(/\/tandas(\?[^/]*)?$/)
})

test('product editor: own URL, Back returns to the list and guards unsaved edits', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.getByRole('link', { name: 'New product' }).click()
  await expect(page).toHaveURL(/\/products\/new$/)
  await expect(page.getByRole('heading', { level: 1, name: 'New product' })).toBeVisible()

  // Unsaved name: Back asks; Cancel keeps the editor and what was typed.
  await page.locator('#product-name').fill('Bread')
  await page.goBack()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Discard unsaved changes')
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/\/products\/new$/)
  await expect(page.locator('#product-name')).toHaveValue('Bread')

  // Saving gives the product its own URL, on the pricing tab, kept on reload.
  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page).toHaveURL(/\/products\/[^/?]+\?tab=variations$/)
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Variations & pricing' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  // Back from the editor lands on the list (not the previous section).
  await page.goBack()
  await expect(page).toHaveURL(/\/products$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible()

  // Edit from the row menu; leaving through the nav with an unsaved change asks.
  await page.getByRole('button', { name: 'Actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\/products\/[^/?]+$/)
  await page.locator('#product-name').fill('Bread loaf')
  await page.getByRole('link', { name: 'Tandas', exact: true }).click()
  await confirm.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page).toHaveURL(/\/tandas$/)
})
