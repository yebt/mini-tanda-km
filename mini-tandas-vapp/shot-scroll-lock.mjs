import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://localhost:4173/')
await page.waitForSelector('.bottom-nav')

await page.locator('.bottom-nav').getByRole('link', { name: /Products/i }).click()
await page.locator('.fab').click()
await page.locator('#product-name').fill('Cake')
await page.getByRole('radio', { name: /Price per SKU/i }).check()
await page.locator('button[type="submit"].btn-primary').click()
await page.getByPlaceholder('New variation, e.g. SIZE').fill('SIZE')
await page.getByRole('button', { name: 'Add variation' }).click()
const sizeEditor = page.locator('.card', { hasText: 'SIZE' }).last()
await sizeEditor.getByPlaceholder('New option, e.g. Coffee').fill('Personal')
await sizeEditor.getByRole('button', { name: 'Add option' }).click()
await page.getByRole('checkbox', { name: /SIZE/ }).check()
const row = page.locator('tr', { hasText: 'Personal' })
await row.locator('input.price-input').fill('90')
await row.locator('input.price-input').press('Tab')

await page.locator('.bottom-nav').getByRole('link', { name: /Clients/i }).click()
await page.getByPlaceholder('Client name').fill('Luna')
await page.locator('form').getByRole('button', { name: 'Add client' }).click()

await page.locator('.bottom-nav').getByRole('link', { name: /Tandas/i }).click()
await page.locator('.fab').click()
await page.getByRole('button', { name: 'Create tanda' }).click()
await page.waitForSelector('.sales-toolbar')
await page.locator('.sales-toolbar').getByRole('button', { name: 'New sale' }).click()
await page.waitForSelector('.dialog-sheet')

const overflowWhileOpen = await page.evaluate(() => document.body.style.overflow)
await page.evaluate(() => window.scrollTo(0, 300))
await page.waitForTimeout(200)
const bgScrollWhileOpen = await page.evaluate(() => window.scrollY)

await page.locator('.dialog-close').click()
await page.waitForSelector('.dialog-sheet', { state: 'detached' })
const overflowAfterClose = await page.evaluate(() => document.body.style.overflow)

console.log(JSON.stringify({ overflowWhileOpen, bgScrollWhileOpen, overflowAfterClose }))
await browser.close()
