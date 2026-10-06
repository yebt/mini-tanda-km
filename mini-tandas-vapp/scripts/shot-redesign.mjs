import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://localhost:4173/')
await page.waitForSelector('.bottom-nav')

await page.locator('.bottom-nav').getByRole('link', { name: /Products/i }).click()
await page.locator('.fab').click()
await page.locator('#product-name').fill('Yogurt')
await page.getByRole('radio', { name: /Price per SKU/i }).check()
await page.locator('button[type="submit"].btn-primary').click()
await page.getByPlaceholder('New variation, e.g. SIZE').fill('SIZE')
await page.getByRole('button', { name: 'Add variation' }).click()
const sizeEditor = page.locator('.card', { hasText: 'SIZE' }).last()
for (const opt of ['1L', '1.8L']) {
  await sizeEditor.getByPlaceholder('New option, e.g. Coffee').fill(opt)
  await sizeEditor.getByRole('button', { name: 'Add option' }).click()
}
await page.getByRole('checkbox', { name: /SIZE/ }).check()
for (const row of await page.locator('input.price-input').all()) {
  await row.fill('10500')
  await row.press('Tab')
}

await page.locator('.bottom-nav').getByRole('link', { name: /Clients/i }).click()
await page.getByPlaceholder('Client name').fill('Sebastian')
await page.locator('form').getByRole('button', { name: 'Add client' }).click()

await page.locator('.bottom-nav').getByRole('link', { name: /Tandas/i }).click()
await page.locator('.fab').click()
await page.getByRole('button', { name: 'Create tanda' }).click()
await page.waitForSelector('.sales-toolbar')
await page.locator('.fab').click()
await page.waitForSelector('.dialog-sheet')

await page.locator('#sale-client').fill('Seb')
await page.getByRole('option', { name: 'Sebastian' }).click()
for (const [sku, qty] of [['1L', '2'], ['1.8L', '1']]) {
  await page.locator('#sale-sku').fill(sku)
  await page.getByRole('option', { name: new RegExp(`Yogurt \\(${sku}\\)`) }).click()
  await page.getByLabel('Quantity').fill(qty)
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.waitForTimeout(150)
}
await page.waitForTimeout(300)
await page.screenshot({ path: 'test-results/redesign-mobile-sheet.png' })
const overflow = await page.evaluate(() => document.documentElement.scrollWidth)
console.log('mobileScrollWidth:', overflow)

// Same session, desktop viewport for the wide layout.
await page.setViewportSize({ width: 1100, height: 800 })
await page.reload()
await page.waitForSelector('.sales-toolbar')
await page.locator('.sales-toolbar').getByRole('button', { name: 'New sale' }).click()
await page.locator('#sale-client').fill('Seb')
await page.getByRole('option', { name: 'Sebastian' }).click()
for (const [sku, qty] of [['1L', '2'], ['1.8L', '1']]) {
  await page.locator('#sale-sku').fill(sku)
  await page.getByRole('option', { name: new RegExp(`Yogurt \\(${sku}\\)`) }).click()
  await page.getByLabel('Quantity').fill(qty)
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.waitForTimeout(150)
}
await page.screenshot({ path: 'test-results/redesign-desktop.png' })
await browser.close()
console.log('OK')
