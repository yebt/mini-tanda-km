import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { createClient, listPayments } from '@shared/db/repos/clients'
import { createProduct, listSkusWithProducts } from '@shared/db/repos/products'
import { createSale, createTanda, listSalesForClient } from '@shared/db/repos/tandas'
import { clearToasts, toasts } from '@shared/ui/useToast'

import PaymentForm from '../PaymentForm.vue'

let clientId: string

async function mountForm() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { render: () => null } }],
  })
  await router.push('/')
  return mount(PaymentForm, {
    props: { clientId },
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  clientId = createClient('Ana')
  clearToasts()
  document.body.innerHTML = ''
})

describe('PaymentForm', () => {
  it('ties a rejected amount to its field, announces it and focuses the field', async () => {
    const wrapper = await mountForm()
    await wrapper.get('#payment-amount').setValue('0')
    await wrapper.get('form').trigger('submit')

    const amount = wrapper.get('#payment-amount')
    const error = wrapper.get('[role="alert"]')
    expect(error.text()).toBe('Amount must be greater than zero.')
    expect(amount.attributes('aria-invalid')).toBe('true')
    expect(amount.attributes('aria-describedby')).toBe(error.attributes('id'))
    expect(document.activeElement).toBe(amount.element)
    wrapper.unmount()
  })

  it('accepts decimal text input, confirms the payment and offers Undo', async () => {
    const wrapper = await mountForm()
    const amount = wrapper.get('#payment-amount')
    expect(amount.attributes('inputmode')).toBe('decimal')
    await amount.setValue('150,50')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(listPayments(clientId).map((p) => p.amount)).toEqual([150.5])
    const toast = toasts.value[0]!
    expect(toast.message).toBe('Payment of MX$150.50 recorded.')
    toast.action!.run()
    expect(listPayments(clientId)).toHaveLength(0)
    wrapper.unmount()
  })
})

/** A $120.00 sale for Ana (one box at the global price). */
function sale120(): string {
  createProduct({ name: 'Box', description: null, photo: null, priceMode: 'global', price: 120 })
  const tandaId = createTanda({ name: 'Weekend', date: '2026-10-10', type: 'scheduled' })
  const result = createSale({
    tandaId,
    clientId,
    items: [{ skuId: listSkusWithProducts()[0]!.id, quantity: 1 }],
  })
  if (!result.ok) throw new Error(result.error)
  return result.saleId
}

describe('PaymentForm over the sale balance', () => {
  it('warns inline instead of recording a payment above what the sale owes', async () => {
    const saleId = sale120()
    const wrapper = await mountForm()
    await wrapper.get('#payment-target').setValue(saleId)
    await wrapper.get('#payment-amount').setValue('5000')

    const warning = wrapper.get('.overpay')
    expect(warning.text()).toContain('This sale only owes MX$120.00')
    expect(warning.text()).toContain('MX$4,880.00')
    expect(wrapper.get('#payment-amount').attributes('aria-describedby')).toContain(
      warning.attributes('id'),
    )

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(listPayments(clientId)).toHaveLength(0)
    wrapper.unmount()
  })

  it('"Apply" sets the amount to the outstanding balance', async () => {
    const saleId = sale120()
    const wrapper = await mountForm()
    await wrapper.get('#payment-target').setValue(saleId)
    await wrapper.get('#payment-amount').setValue('5000')
    await wrapper.get('.overpay button.apply-balance').trigger('click')

    expect((wrapper.get('#payment-amount').element as HTMLInputElement).value).toBe('120.00')
    expect(wrapper.find('.overpay').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('#payment-amount').element)
    wrapper.unmount()
  })

  it('"Record as credit" pays the sale in full and keeps the rest as a general payment', async () => {
    const saleId = sale120()
    const wrapper = await mountForm()
    await wrapper.get('#payment-target').setValue(saleId)
    await wrapper.get('#payment-amount').setValue('5000')
    await wrapper.get('.overpay button.record-credit').trigger('click')
    await flushPromises()

    const payments = listPayments(clientId)
    expect(payments.map((p) => [p.saleId, p.amount]).sort()).toEqual(
      [
        [saleId, 120],
        [null, 4880],
      ].sort(),
    )
    expect(listSalesForClient(clientId).find((sale) => sale.id === saleId)?.balance).toBe(0)
    const toast = toasts.value[toasts.value.length - 1]!
    expect(toast.message).toBe(
      'Payment of MX$5,000.00 recorded: MX$120.00 to the sale, MX$4,880.00 as credit.',
    )
    toast.action!.run()
    expect(listPayments(clientId)).toHaveLength(0)
    wrapper.unmount()
  })

  it('does not warn for an exact payment or a general payment', async () => {
    const saleId = sale120()
    const wrapper = await mountForm()
    await wrapper.get('#payment-target').setValue(saleId)
    await wrapper.get('#payment-amount').setValue('120')
    expect(wrapper.find('.overpay').exists()).toBe(false)

    await wrapper.get('#payment-amount').setValue('5000')
    await wrapper.get('#payment-target').setValue('')
    expect(wrapper.find('.overpay').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    expect(listPayments(clientId).map((p) => [p.saleId, p.amount])).toEqual([[null, 5000]])
    wrapper.unmount()
  })
})
