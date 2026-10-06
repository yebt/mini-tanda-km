import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { createClient, listPayments } from '@shared/db/repos/clients'
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
