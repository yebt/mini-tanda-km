import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'

import TabList from '../TabList.vue'

const tabs = [
  { value: 'sales', label: 'Sales' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'notes', label: 'Notes' },
]

let wrapper: VueWrapper | null = null

function mountTabs(modelValue = 'sales') {
  wrapper = mount(TabList, {
    props: {
      tabs,
      modelValue,
      idBase: 'tanda',
      label: 'Tanda views',
      'onUpdate:modelValue': (value: string) => wrapper!.setProps({ modelValue: value }),
    },
    attachTo: document.body,
  })
  return wrapper
}

function lastSelected(w: VueWrapper): unknown {
  const events = w.emitted('update:modelValue') ?? []
  return events[events.length - 1]
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('TabList', () => {
  it('exposes the WAI-ARIA tabs relationships with a roving tabindex', () => {
    const w = mountTabs('inventory')
    const list = w.get('[role="tablist"]')
    expect(list.attributes('aria-label')).toBe('Tanda views')
    const buttons = w.findAll('[role="tab"]')
    expect(buttons.map((b) => b.attributes('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(buttons.map((b) => b.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(buttons[1]!.attributes('id')).toBe('tanda-tab-inventory')
    expect(buttons[1]!.attributes('aria-controls')).toBe('tanda-panel-inventory')
  })

  it('moves and activates with arrow keys, Home and End, wrapping around', async () => {
    const w = mountTabs('sales')
    const first = w.findAll('[role="tab"]')[0]!
    ;(first.element as HTMLElement).focus()

    await first.trigger('keydown', { key: 'ArrowRight' })
    expect(lastSelected(w)).toEqual(['inventory'])
    expect(document.activeElement?.id).toBe('tanda-tab-inventory')

    await w.get('#tanda-tab-inventory').trigger('keydown', { key: 'End' })
    expect(document.activeElement?.id).toBe('tanda-tab-notes')

    await w.get('#tanda-tab-notes').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement?.id).toBe('tanda-tab-sales')

    await w.get('#tanda-tab-sales').trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement?.id).toBe('tanda-tab-notes')

    await w.get('#tanda-tab-notes').trigger('keydown', { key: 'Home' })
    expect(lastSelected(w)).toEqual(['sales'])
  })
})
