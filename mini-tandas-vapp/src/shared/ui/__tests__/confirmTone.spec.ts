import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import ConfirmDialogHost from '../ConfirmDialogHost.vue'
import { confirmDialog, useConfirmHost } from '../useConfirm'

let wrapper: VueWrapper | null = null

afterEach(async () => {
  useConfirmHost().dismiss()
  await nextTick()
  wrapper?.unmount()
  wrapper = null
})

describe('confirm tone', () => {
  it('renders destructive confirms as a danger button set apart from Cancel', async () => {
    wrapper = mount(ConfirmDialogHost, { attachTo: document.body })
    void confirmDialog('Delete the sale?', 'Delete', { tone: 'danger' })
    await nextTick()
    const confirm = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete',
    )!
    expect(confirm.classList.contains('btn-danger-solid')).toBe(true)
    expect(confirm.classList.contains('btn-primary')).toBe(false)
  })

  it('keeps the primary style for non-destructive confirms', async () => {
    wrapper = mount(ConfirmDialogHost, { attachTo: document.body })
    void confirmDialog('Advance?', 'Advance')
    await nextTick()
    const confirm = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Advance',
    )!
    expect(confirm.classList.contains('btn-primary')).toBe(true)
  })
})
