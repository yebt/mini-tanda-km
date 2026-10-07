import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import QuantityStepper from '../QuantityStepper.vue'

function mountStepper(props: { modelValue: number; min?: number; max?: number }) {
  const wrapper = mount(QuantityStepper, {
    props: {
      label: 'Units of Cake',
      decreaseLabel: 'One less Cake',
      increaseLabel: 'One more Cake',
      ...props,
      'onUpdate:modelValue': (value: number) => wrapper.setProps({ modelValue: value }),
    },
    attachTo: document.body,
  })
  return wrapper
}

const input = (w: ReturnType<typeof mountStepper>) => w.get<HTMLInputElement>('input')
const decrease = (w: ReturnType<typeof mountStepper>) => w.get('button[aria-label="One less Cake"]')
const increase = (w: ReturnType<typeof mountStepper>) => w.get('button[aria-label="One more Cake"]')

describe('QuantityStepper', () => {
  it('renders −, a labelled number input and + (only the input carries the label)', () => {
    const wrapper = mountStepper({ modelValue: 2, max: 5 })
    expect(wrapper.findAll('[aria-label="Units of Cake"]')).toHaveLength(1)
    expect(input(wrapper).attributes('aria-label')).toBe('Units of Cake')
    expect(input(wrapper).attributes('min')).toBe('1')
    expect(input(wrapper).attributes('max')).toBe('5')
    expect(input(wrapper).element.value).toBe('2')
    expect(wrapper.findAll('button')).toHaveLength(2)
    wrapper.unmount()
  })

  it('steps with the buttons and disables them at the bounds', async () => {
    const wrapper = mountStepper({ modelValue: 1, max: 2 })
    expect(decrease(wrapper).attributes('disabled')).toBeDefined()
    expect(increase(wrapper).attributes('disabled')).toBeUndefined()

    await increase(wrapper).trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
    expect(input(wrapper).element.value).toBe('2')
    expect(increase(wrapper).attributes('disabled')).toBeDefined()
    expect(decrease(wrapper).attributes('disabled')).toBeUndefined()

    await decrease(wrapper).trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[2], [1]])
    wrapper.unmount()
  })

  it('clamps typed values to the bounds and reverts invalid ones on change', async () => {
    const wrapper = mountStepper({ modelValue: 2, max: 5 })
    await input(wrapper).setValue('9')
    expect(wrapper.props('modelValue')).toBe(5)
    await input(wrapper).trigger('change')
    expect(input(wrapper).element.value).toBe('5')

    await input(wrapper).setValue('0')
    await input(wrapper).trigger('change')
    expect(wrapper.props('modelValue')).toBe(5)
    expect(input(wrapper).element.value).toBe('5')

    await input(wrapper).setValue('abc')
    await input(wrapper).trigger('change')
    expect(input(wrapper).element.value).toBe('5')

    await input(wrapper).setValue('3')
    expect(wrapper.props('modelValue')).toBe(3)
    wrapper.unmount()
  })

  it('supports ArrowUp / ArrowDown / Home / End within the bounds, and Enter', async () => {
    const wrapper = mountStepper({ modelValue: 2, max: 4 })
    await input(wrapper).trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.props('modelValue')).toBe(3)
    await input(wrapper).trigger('keydown', { key: 'End' })
    expect(wrapper.props('modelValue')).toBe(4)
    await input(wrapper).trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.props('modelValue')).toBe(4)
    await input(wrapper).trigger('keydown', { key: 'Home' })
    expect(wrapper.props('modelValue')).toBe(1)
    await input(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.props('modelValue')).toBe(1)

    await input(wrapper).setValue('2')
    await input(wrapper).trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('enter')).toHaveLength(1)
    expect(wrapper.props('modelValue')).toBe(2)
    wrapper.unmount()
  })

  it('has no upper bound by default', async () => {
    const wrapper = mountStepper({ modelValue: 99 })
    expect(input(wrapper).attributes('max')).toBeUndefined()
    await increase(wrapper).trigger('click')
    expect(wrapper.props('modelValue')).toBe(100)
    wrapper.unmount()
  })
})
