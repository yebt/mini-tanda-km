import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'

import { openWithInstance } from '@shared/db/database'
import { createClient, getClient } from '@shared/db/repos/clients'
import { clearToasts, toasts } from '@shared/ui/useToast'

import RenameClientDialog from '../RenameClientDialog.vue'

let wrapper: VueWrapper | null = null

function mountDialog(client: { id: string; name: string }) {
  wrapper = mount(RenameClientDialog, { props: { client }, attachTo: document.body })
  return wrapper
}

const input = () => document.querySelector<HTMLInputElement>('#rename-client-name')!
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const submit = () =>
  dialog().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))

async function type(value: string) {
  input().value = value
  input().dispatchEvent(new Event('input'))
  await wrapper!.vm.$nextTick()
}

beforeEach(async () => {
  const SQL = await initSqlJs()
  openWithInstance(new SQL.Database())
  setActivePinia(createPinia())
  clearToasts()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('RenameClientDialog', () => {
  it('opens named, prefilled and focused on the name field', async () => {
    const id = createClient('Lupe')
    mountDialog({ id, name: 'Lupe' })
    await wrapper!.vm.$nextTick()
    expect(document.getElementById(dialog().getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Rename client',
    )
    expect(input().value).toBe('Lupe')
    expect(document.activeElement).toBe(input())
  })

  it('renames, confirms and closes', async () => {
    const id = createClient('Lupe')
    mountDialog({ id, name: 'Lupe' })
    await type('  Lupita ')
    submit()
    await wrapper!.vm.$nextTick()
    expect(getClient(id)?.name).toBe('Lupita')
    expect(toasts.value[toasts.value.length - 1]?.message).toBe('Renamed "Lupe" to "Lupita".')
    expect(wrapper!.emitted('close')).toHaveLength(1)
  })

  it('keeps the dialog open with a field error for an empty name', async () => {
    const id = createClient('Lupe')
    mountDialog({ id, name: 'Lupe' })
    await type('  ')
    submit()
    await wrapper!.vm.$nextTick()
    const error = document.getElementById(input().getAttribute('aria-describedby')!)
    expect(error?.textContent).toBe('Enter a name.')
    expect(input().getAttribute('aria-invalid')).toBe('true')
    expect(getClient(id)?.name).toBe('Lupe')
    expect(wrapper!.emitted('close')).toBeUndefined()
  })

  it('warns about a duplicate name and saves only when confirmed', async () => {
    createClient('José Hernández')
    const id = createClient('jose')
    mountDialog({ id, name: 'jose' })
    await type('Jose Hernandez')
    submit()
    await wrapper!.vm.$nextTick()
    expect(dialog().textContent).toContain('Another client is already called "José Hernández"')
    expect(getClient(id)?.name).toBe('jose')

    const save = [...dialog().querySelectorAll('button')].find((b) => b.type === 'submit')!
    expect(save.textContent?.trim()).toBe('Rename anyway')
    submit()
    await wrapper!.vm.$nextTick()
    expect(getClient(id)?.name).toBe('Jose Hernandez')
  })

  it('closes without changes on Cancel', async () => {
    const id = createClient('Lupe')
    mountDialog({ id, name: 'Lupe' })
    const cancel = [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Cancel')!
    cancel.click()
    expect(wrapper!.emitted('close')).toHaveLength(1)
    expect(getClient(id)?.name).toBe('Lupe')
  })
})
