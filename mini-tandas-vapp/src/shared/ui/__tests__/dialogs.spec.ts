import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

import SaleDialog from '@/features/tandas/components/SaleDialog.vue'
import ConfirmDialogHost from '../ConfirmDialogHost.vue'
import { confirmDialog } from '../useConfirm'

const mounted: VueWrapper[] = []
let opener: HTMLButtonElement

function track<T extends VueWrapper>(wrapper: T): T {
  mounted.push(wrapper)
  return wrapper
}

function focusOpener(): void {
  opener = document.createElement('button')
  opener.textContent = 'Open'
  document.body.appendChild(opener)
  opener.focus()
}

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  ;(document.activeElement ?? document.body).dispatchEvent(event)
  return event
}

const active = () => document.activeElement as HTMLElement

/** Stand-in for SaleForm: a titled form whose first field autofocuses. */
const SaleFormStub = defineComponent({
  props: { titleId: { type: String, default: undefined } },
  mounted() {
    ;(this.$el as HTMLElement).querySelector('input')?.focus()
  },
  render() {
    return h('section', [
      h('h2', { id: this.titleId }, 'New sale'),
      h('input', { id: 'sale-sku' }),
      h('button', { type: 'button' }, 'Add sale'),
    ])
  },
})

function mountSaleDialog() {
  return track(
    mount(SaleDialog, {
      props: { tandaId: 't1', type: 'scheduled' },
      global: { stubs: { SaleForm: SaleFormStub } },
      attachTo: document.body,
    }),
  )
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

describe('ConfirmDialogHost', () => {
  it('names the dialog, focuses Cancel, traps Tab and restores focus on Escape', async () => {
    track(mount(ConfirmDialogHost, { attachTo: document.body }))
    focusOpener()

    const answer = confirmDialog('Delete this sale?', 'Delete')
    await nextTick()
    await nextTick()

    const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')!
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!)
    const message = document.getElementById(dialog.getAttribute('aria-describedby')!)
    expect(title?.textContent).toBe('Please confirm')
    expect(message?.textContent).toBe('Delete this sale?')
    expect(active().textContent).toBe('Cancel')

    press('Tab', { shiftKey: true })
    expect(active().textContent?.trim()).toBe('Delete')
    press('Tab')
    expect(active().textContent).toBe('Cancel')

    press('Escape')
    await flushPromises()
    expect(await answer).toBe(false)
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(active()).toBe(opener)
  })
})

describe('SaleDialog', () => {
  it('moves focus inside, is named by its heading, closes on Escape and restores focus', async () => {
    focusOpener()
    const wrapper = mountSaleDialog()
    await nextTick()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'New sale',
    )
    expect(dialog.contains(active())).toBe(true)

    press('Escape')
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)
    expect(active()).toBe(opener)
  })

  it('keeps Tab inside the sheet', async () => {
    focusOpener()
    mountSaleDialog()
    await nextTick()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const close = dialog.querySelector<HTMLElement>('[aria-label="Close"]')!
    const buttons = dialog.querySelectorAll<HTMLElement>('button')
    const addSale = buttons[buttons.length - 1]!
    addSale.focus()
    press('Tab')
    expect(active()).toBe(close)
    press('Tab', { shiftKey: true })
    expect(active()).toBe(addSale)
  })

  it('lets only the topmost dialog handle Escape', async () => {
    track(mount(ConfirmDialogHost, { attachTo: document.body }))
    focusOpener()
    const wrapper = mountSaleDialog()
    await nextTick()

    const answer = confirmDialog('Remove this line?', 'Remove')
    await nextTick()
    await nextTick()

    press('Escape')
    expect(await answer).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()
    await nextTick()
    expect(document.querySelector<HTMLElement>('[role="dialog"]')!.contains(active())).toBe(true)

    press('Escape')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('ignores an Escape already handled by an inner widget', async () => {
    focusOpener()
    const wrapper = mountSaleDialog()
    await nextTick()

    const input = document.querySelector<HTMLInputElement>('#sale-sku')!
    input.addEventListener('keydown', (event) => event.preventDefault())
    press('Escape')
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
