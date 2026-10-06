import { describe, expect, it, vi } from 'vitest'

import { renderBootError } from '../bootError'

describe('renderBootError', () => {
  it('replaces the splash with an announced, actionable message', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="boot-splash">Loading Mini Tanda…</div>'

    renderBootError(container, new Error('QuotaExceededError'))

    expect(container.querySelector('.boot-splash')).toBeNull()
    const alert = container.querySelector('[role="alert"]')!
    expect(alert.querySelector('h1')?.textContent).toBe('Mini Tanda could not start')
    expect(alert.textContent).toContain('private')
    expect(alert.textContent).toContain('QuotaExceededError')
    expect(alert.textContent).toMatch(/export/i)
  })

  it('offers a reload', () => {
    const reload = vi.fn<() => void>()
    const container = document.createElement('div')
    renderBootError(container, 'boom', reload)
    container.querySelector<HTMLButtonElement>('button')!.click()
    expect(reload).toHaveBeenCalledOnce()
  })
})
