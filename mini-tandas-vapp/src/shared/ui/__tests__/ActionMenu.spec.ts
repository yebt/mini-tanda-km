import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import ActionMenu from '../ActionMenu.vue'

let wrapper: VueWrapper | null = null
const active = () => document.activeElement as HTMLElement

async function openMenu() {
  wrapper = mount(ActionMenu, { props: { showPay: true }, attachTo: document.body })
  const trigger = wrapper.get('button.kebab')
  ;(trigger.element as HTMLElement).focus()
  await trigger.trigger('click')
  await nextTick()
  return { wrapper, trigger: trigger.element as HTMLElement }
}

function press(key: string) {
  active().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  return nextTick()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ActionMenu', () => {
  it('focuses the first item on open and moves with the arrow keys', async () => {
    await openMenu()
    expect(active().textContent?.trim()).toBe('Record payment')
    await press('ArrowDown')
    expect(active().textContent?.trim()).toBe('Edit')
    await press('End')
    expect(active().textContent?.trim()).toBe('Delete')
    await press('ArrowDown')
    expect(active().textContent?.trim()).toBe('Record payment')
    await press('ArrowUp')
    expect(active().textContent?.trim()).toBe('Delete')
    await press('Home')
    expect(active().textContent?.trim()).toBe('Record payment')
  })

  it('closes on Escape from an item and returns focus to the trigger', async () => {
    const { wrapper, trigger } = await openMenu()
    await press('ArrowDown')
    await press('Escape')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(active()).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes when focus leaves the menu', async () => {
    const { wrapper } = await openMenu()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })
})
