import { expect, test } from '@playwright/test'

test('clients: rename from the list and the client page', async ({ page }) => {
  await page.goto('/clients')
  await page.getByRole('textbox', { name: 'New client' }).fill('Lupe')
  await page.getByRole('button', { name: 'Add client' }).click()
  await page.getByRole('textbox', { name: 'New client' }).fill('Ana López')
  await page.getByRole('button', { name: 'Add client' }).click()

  // From the list: fix the typo.
  const lupeRow = page.locator('tr', { hasText: 'Lupe' })
  await lupeRow.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rename client' })
  await expect(dialog.getByLabel('Name')).toBeFocused()
  await dialog.getByLabel('Name').fill('Lupita')
  await dialog.getByRole('button', { name: 'Rename' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Lupita' })).toBeVisible()

  // From the client page: a duplicate name warns first.
  await page.getByRole('link', { name: 'Lupita' }).click()
  // The summary card's menu comes first on the client page.
  await page.getByRole('button', { name: 'Actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await dialog.getByLabel('Name').fill('ana lopez')
  await dialog.getByRole('button', { name: 'Rename' }).click()
  await expect(dialog).toContainText('Another client is already called "Ana López"')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lupita' })).toBeVisible()
})
