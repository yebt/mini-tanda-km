import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'

import ProductGeneralTab from '../ProductGeneralTab.vue'

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
})

function mountTab() {
  return mount(ProductGeneralTab, { props: { initial: null }, attachTo: document.body })
}

/** Simulate the user picking `file` in the real file input. */
async function pick(wrapper: VueWrapper, file: File) {
  const input = wrapper.get<HTMLInputElement>('#product-photo')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  // FileReader resolves on a later task.
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

describe('ProductGeneralTab photo picker', () => {
  it('keeps a real, labelled image file input behind a "Choose photo" control', () => {
    const wrapper = mountTab()
    const input = wrapper.get<HTMLInputElement>('#product-photo')
    expect(input.attributes('type')).toBe('file')
    expect(input.attributes('accept')).toBe('image/*')
    const labels = [...(input.element.labels ?? [])].map((label) => label.textContent?.trim())
    expect(labels).toContain('Photo')
    expect(labels).toContain('Choose photo')
    // Empty state: a placeholder tile, no remove action.
    expect(wrapper.find('.photo-tile img').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().startsWith('Remove'))).toBe(false)
    wrapper.unmount()
  })

  it('previews a picked photo, offers "Change photo" and removes it', async () => {
    const wrapper = mountTab()
    await pick(wrapper, new File(['img'], 'cake.png', { type: 'image/png' }))

    expect(wrapper.get('.photo-tile img').attributes('src')).toMatch(/^data:image\/png/)
    expect(wrapper.get('label.photo-choose').text()).toBe('Change photo')

    const remove = wrapper.findAll('button').find((b) => b.text() === 'Remove photo')!
    await remove.trigger('click')
    expect(wrapper.find('.photo-tile img').exists()).toBe(false)
    expect(wrapper.get('label.photo-choose').text()).toBe('Choose photo')
    wrapper.unmount()
  })

  it('rejects images over 1 MB with an error tied to the input', async () => {
    const wrapper = mountTab()
    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    await pick(wrapper, big)

    const input = wrapper.get('#product-photo')
    expect(input.attributes('aria-invalid')).toBe('true')
    const describedBy = input.attributes('aria-describedby')!.split(' ')
    expect(describedBy).toContain('product-photo-error')
    expect(wrapper.get('#product-photo-error').text()).toBe(
      'Image is larger than 1 MB — choose a smaller file.',
    )
    expect(wrapper.find('.photo-tile img').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('ProductGeneralTab price mode', () => {
  it('is a native radio group in a fieldset, each option named by its title', async () => {
    const wrapper = mountTab()
    const fieldset = wrapper.get('fieldset')
    expect(fieldset.get('legend').text()).toBe('Price mode')

    const radios = fieldset.findAll<HTMLInputElement>('input[type="radio"]')
    expect(radios).toHaveLength(2)
    const names = radios.map((radio) => {
      const ids = radio.attributes('aria-labelledby')!.split(' ')
      return ids.map((id) => document.getElementById(id)?.textContent?.trim()).join(' ')
    })
    expect(names).toEqual(['Global price', 'Price per SKU'])
    for (const radio of radios) {
      const desc = document.getElementById(radio.attributes('aria-describedby')!)
      expect(desc?.textContent?.trim()).toBeTruthy()
    }

    expect(radios[0]!.element.checked).toBe(true)
    expect(wrapper.find('#product-price').exists()).toBe(true)
    await radios[1]!.setValue(true)
    expect(radios[1]!.element.checked).toBe(true)
    expect(wrapper.find('#product-price').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('ProductGeneralTab unsaved changes', () => {
  type Exposed = { hasUnsavedChanges: () => boolean }

  it('is clean when opened and dirty after typing a name', async () => {
    const wrapper = mountTab()
    const vm = wrapper.vm as unknown as Exposed
    expect(vm.hasUnsavedChanges()).toBe(false)
    await wrapper.get('#product-name').setValue('Cake')
    expect(vm.hasUnsavedChanges()).toBe(true)
    wrapper.unmount()
  })

  it('tracks edits against the saved product and is clean again after saving', async () => {
    const { useProductsStore } = await import('@shared/stores/products')
    const store = useProductsStore()
    const id = store.saveProduct({ name: 'Bread', description: null, priceMode: 'global', price: 10 })
    const product = store.catalog.find((entry) => entry.product.id === id)!.product
    const wrapper = mount(ProductGeneralTab, { props: { initial: product }, attachTo: document.body })
    const vm = wrapper.vm as unknown as Exposed
    expect(vm.hasUnsavedChanges()).toBe(false)

    await wrapper.get('#product-description').setValue('Fresh')
    expect(vm.hasUnsavedChanges()).toBe(true)
    await wrapper.get('#product-description').setValue('')
    expect(vm.hasUnsavedChanges()).toBe(false)

    await wrapper.get('#product-name').setValue('Bread loaf')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(vm.hasUnsavedChanges()).toBe(false)
    wrapper.unmount()
  })
})
