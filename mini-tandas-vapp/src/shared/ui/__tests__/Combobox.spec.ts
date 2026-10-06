import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'

import Combobox, { type ComboOption } from '../Combobox.vue'

const OPTIONS: ComboOption[] = [
  { value: 'a', label: 'Apple pie' },
  { value: 'b', label: 'Banana bread', disabled: true, disabledReason: 'No price set' },
  { value: 'c', label: 'Carrot cake' },
]

let wrapper: VueWrapper | null = null

function mountCombo(props: Partial<{ modelValue: string; allowCreate: boolean }> = {}) {
  wrapper = mount(Combobox, {
    props: { modelValue: '', options: OPTIONS, inputId: 'combo', ...props },
    attachTo: document.body,
  })
  return wrapper
}

const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]')!
const optionEls = () => Array.from(listbox().querySelectorAll<HTMLElement>('[role="option"]'))
const activeOption = (input: HTMLInputElement) =>
  document.getElementById(input.getAttribute('aria-activedescendant') ?? '')

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('Combobox (WAI-ARIA combobox pattern)', () => {
  it('exposes combobox/listbox/option roles and relationships', async () => {
    const combo = mountCombo()
    const input = combo.get('input').element as HTMLInputElement
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-controls')).toBe(listbox().id)

    await combo.get('input').trigger('keydown', { key: 'ArrowDown' })
    expect(input.getAttribute('aria-expanded')).toBe('true')
    const [apple, banana] = optionEls()
    expect(apple!.id).toBeTruthy()
    expect(apple!.getAttribute('aria-selected')).toBe('false')
    expect(banana!.getAttribute('aria-disabled')).toBe('true')

    await combo.setProps({ modelValue: 'c' })
    expect(
      optionEls()
        .find((option) => option.textContent?.includes('Carrot'))!
        .getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('moves the active option with the arrows, skipping disabled ones', async () => {
    const combo = mountCombo()
    const input = combo.get('input')
    const el = input.element as HTMLInputElement

    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(activeOption(el)?.textContent).toContain('Apple pie')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(activeOption(el)?.textContent).toContain('Carrot cake')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(activeOption(el)?.textContent).toContain('Carrot cake')
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(activeOption(el)?.textContent).toContain('Apple pie')
  })

  it('selects the active option with Enter without letting the key bubble', async () => {
    const combo = mountCombo()
    const input = combo.get('input')
    await input.trigger('keydown', { key: 'ArrowUp' })

    let bubbled = 0
    const count = () => bubbled++
    document.addEventListener('keydown', count)
    await input.trigger('keydown', { key: 'Enter' })
    document.removeEventListener('keydown', count)

    expect(combo.emitted('update:modelValue')).toEqual([['c']])
    expect(input.attributes('aria-expanded')).toBe('false')
    expect(input.attributes('aria-activedescendant')).toBeUndefined()
    expect(bubbled).toBe(0)
  })

  it('lets Enter bubble when no option is active', async () => {
    const combo = mountCombo()
    let bubbled = 0
    const count = () => bubbled++
    document.addEventListener('keydown', count)
    await combo.get('input').trigger('keydown', { key: 'Enter' })
    document.removeEventListener('keydown', count)
    expect(bubbled).toBe(1)
    expect(combo.emitted('update:modelValue')).toBeUndefined()
  })

  it('reaches the "Create" row from the keyboard', async () => {
    const combo = mountCombo({ allowCreate: true })
    const input = combo.get('input')
    await input.setValue('Donut')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(combo.emitted('create')).toEqual([['Donut']])
  })

  it('closes the list on Escape and marks the key handled only while open', async () => {
    const combo = mountCombo()
    const input = combo.get('input')
    const el = input.element

    await input.trigger('keydown', { key: 'ArrowDown' })
    const whileOpen = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(whileOpen)
    await combo.vm.$nextTick()
    expect(whileOpen.defaultPrevented).toBe(true)
    expect(input.attributes('aria-expanded')).toBe('false')

    // Closed: Escape is left for the surrounding dialog.
    const whileClosed = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(whileClosed)
    expect(whileClosed.defaultPrevented).toBe(false)
  })
})
