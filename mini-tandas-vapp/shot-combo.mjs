import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
await page.goto('http://localhost:4173/')
await page.waitForSelector('text=Dashboard')

await page.locator('nav').getByRole('link', { name: 'Products', exact: true }).first().click()
await page.getByRole('button', { name: 'New product' }).click()
await page.locator('#product-name').fill('Yogurt')
await page.getByRole('radio', { name: /Price per SKU/i }).check()
await page.locator('button[type="submit"].btn-primary').click()
await page.getByPlaceholder('New variation, e.g. SIZE').fill('FLAVOR')
await page.getByRole('button', { name: 'Add variation' }).click()
const editor = page.locator('.card', { hasText: 'FLAVOR' }).last()
for (const flavor of ['Fresa', 'Mora', 'Melocotón', 'Natural', 'Café', 'Vainilla', 'Mango', 'Limón']) {
  await editor.getByPlaceholder('New option, e.g. Coffee').fill(flavor)
  await editor.getByRole('button', { name: 'Add option' }).click()
}
await page.getByRole('checkbox', { name: /FLAVOR/ }).check()
for (const row of await page.locator('input.price-input').all()) {
  await row.fill('10500')
  await row.press('Tab')
}

await page.locator('nav').getByRole('link', { name: 'Clients', exact: true }).first().click()
await page.getByPlaceholder('Client name').fill('Sebastian')
await page.locator('form').getByRole('button', { name: 'Add client' }).click()

await page.locator('nav').getByRole('link', { name: 'Tandas', exact: true }).first().click()
await page.getByRole('button', { name: 'New tanda' }).click()
await page.getByRole('button', { name: 'Create tanda' }).click()
await page.waitForSelector('.sales-toolbar')
await page.locator('.sales-toolbar').getByRole('button', { name: 'New sale' }).click()
await page.locator('#sale-sku').click()
await page.waitForSelector('.combo-list')
await page.waitForTimeout(300)
await page.screenshot({ path: 'test-results/combo-teleported.png' })

// Verify the list escapes the dialog box horizontally/vertically.
const box = await page.evaluate(() => {
  const sheet = document.querySelector('.dialog-sheet').getBoundingClientRect()
  const list = document.querySelector('.combo-list').getBoundingClientRect()
  return { sheetBottom: sheet.bottom, listBottom: list.bottom, listTop: list.top, viewportH: window.innerHeight }
})
console.log(JSON.stringify(box))
await browser.close()
