import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

import { useBackToClose } from '../useBackToClose'

let wrapper: VueWrapper | null = null

function mountOverlay(onBack: () => boolean | Promise<boolean>) {
  const Overlay = defineComponent({
    setup() {
      useBackToClose(onBack)
      return () => h('div', 'sheet')
    },
  })
  wrapper = mount(Overlay)
  return wrapper
}

/** jsdom fires popstate asynchronously after history.back(). */
function waitForPopState(): Promise<void> {
  return new Promise((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('useBackToClose', () => {
  it('pushes a history entry while mounted and removes it on a normal close', async () => {
    const before = history.length
    const overlay = mountOverlay(() => true)
    expect(history.length).toBe(before + 1)
    expect((history.state as { overlay?: string }).overlay).toBeTruthy()

    const popped = waitForPopState()
    overlay.unmount()
    wrapper = null
    await popped
    expect((history.state as { overlay?: string } | null)?.overlay).toBeUndefined()
  })

  it('asks the overlay to close when Back pops its entry', async () => {
    const onBack = vi.fn<() => boolean>(() => true)
    mountOverlay(onBack)
    const popped = waitForPopState()
    history.back()
    await popped
    await Promise.resolve()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('restores its entry when the overlay refuses to close (draft kept)', async () => {
    const onBack = vi.fn<() => Promise<boolean>>(async () => false)
    mountOverlay(onBack)
    const popped = waitForPopState()
    history.back()
    await popped
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    await vi.waitFor(() =>
      expect((history.state as { overlay?: string } | null)?.overlay).toBeTruthy(),
    )
  })
})
