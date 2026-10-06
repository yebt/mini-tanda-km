import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import ToastHost from '../ToastHost.vue'
import { clearToasts, notify } from '../useToast'

afterEach(() => {
  clearToasts()
  vi.useRealTimers()
})

describe('toasts', () => {
  it('announces outcomes in a polite live region that exists before any toast', async () => {
    const wrapper = mount(ToastHost)
    const region = wrapper.get('[role="status"]')
    expect(region.attributes('aria-live')).toBe('polite')

    notify('Client "Ana" added.')
    await nextTick()
    expect(region.text()).toContain('Client "Ana" added.')
  })

  it('runs the undo action once and dismisses the toast', async () => {
    const undo = vi.fn<() => void>()
    const wrapper = mount(ToastHost)
    notify('Payment recorded.', { action: { label: 'Undo', run: undo } })
    await nextTick()

    await wrapper.get('button.toast-action').trigger('click')
    expect(undo).toHaveBeenCalledOnce()
    expect(wrapper.text()).not.toContain('Payment recorded.')
  })

  it('dismisses itself after a while', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ToastHost)
    notify('Saved.')
    await nextTick()
    expect(wrapper.text()).toContain('Saved.')
    vi.advanceTimersByTime(10_000)
    await nextTick()
    expect(wrapper.text()).not.toContain('Saved.')
  })
})
