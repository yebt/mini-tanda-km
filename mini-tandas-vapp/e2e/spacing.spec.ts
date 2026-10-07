import { expect, test } from '@playwright/test'

/** Gaps (px) between the dashboard's "Next up" card and its stat cards. */
async function dashboardGaps(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('.stat-card').first()).toBeVisible()
  return page.evaluate(() => {
    const nextUp = document.querySelector('.next-up')!.getBoundingClientRect()
    const stats = [...document.querySelectorAll('.stat-card')].map((card) =>
      card.getBoundingClientRect(),
    )
    const firstRow = stats.filter((rect) => Math.abs(rect.top - stats[0]!.top) < 1)
    const [left, right] = [...firstRow].sort((a, b) => a.left - b.left)
    return {
      vertical: Math.round(Math.min(...stats.map((rect) => rect.top)) - nextUp.bottom),
      horizontal: Math.round(right!.left - left!.right),
      cardPadding: [...document.querySelectorAll('.next-up, .stat-card')].map(
        (card) => getComputedStyle(card).paddingLeft,
      ),
    }
  })
}

for (const [layout, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  test(`dashboard cards share one gap and one padding (${layout})`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const gaps = await dashboardGaps(page)

    expect(gaps.horizontal).toBe(gaps.vertical)
    expect(new Set(gaps.cardPadding).size).toBe(1)
  })
}
