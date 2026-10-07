import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { useProductsStore } from '@shared/stores/products'

import VariationEditor from '../VariationEditor.vue'

let productId: string

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  productId = useProductsStore().saveProduct({
    name: 'Yogurt',
    description: null,
    photo: null,
    priceMode: 'per_sku',
    price: null,
  })
  document.body.innerHTML = ''
})

/** Renders the editor the way the product tab does: fed from the store. */
const Host = defineComponent({
  setup() {
    const store = useProductsStore()
    return () =>
      h(VariationEditor, {
        product: store.products.find((candidate) => candidate.id === productId)!,
      })
  },
})

function mountEditor() {
  return mount(Host, { attachTo: document.body })
}

function optionInput(name: string): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`input[aria-label="New option for ${name}"]`)!
}

describe('VariationEditor focus flow', () => {
  it('after "Add variation", focuses the new variation\'s "New option" input', async () => {
    const wrapper = mountEditor()
    await wrapper.get('#variation-name-input').setValue('Size')
    await wrapper.findAll('button').find((b) => b.text() === 'Add variation')!.trigger('click')
    await flushPromises()

    expect(optionInput('Size')).toBeTruthy()
    expect(document.activeElement).toBe(optionInput('Size'))
    wrapper.unmount()
  })

  it('also focuses it when the variation is added with Enter', async () => {
    const wrapper = mountEditor()
    const name = wrapper.get('#variation-name-input')
    await name.setValue('Flavor')
    await name.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(document.activeElement).toBe(optionInput('Flavor'))
    wrapper.unmount()
  })

  it('after "Add option", clears and refocuses the same "New option" input', async () => {
    useProductsStore().addVariation(productId, 'Size')
    const wrapper = mountEditor()
    await flushPromises()

    const input = wrapper.get('input[aria-label="New option for Size"]')
    await input.setValue('1L')
    const addOption = wrapper.findAll('button').find((b) => b.text() === 'Add option')!
    ;(addOption.element as HTMLButtonElement).focus()
    await addOption.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('1L')
    expect(optionInput('Size').value).toBe('')
    expect(document.activeElement).toBe(optionInput('Size'))

    // Enter keeps focus there too, ready for the next option.
    await input.setValue('500ml')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('500ml')
    expect(optionInput('Size').value).toBe('')
    expect(document.activeElement).toBe(optionInput('Size'))
    wrapper.unmount()
  })
})
