import { computed } from 'vue'
import { defineStore } from 'pinia'

import { track } from '@shared/db/database'
import {
  addPayment,
  clientInUse,
  createClient,
  deleteClient,
  deletePayment,
  listClients,
  listPayments,
  renameClient as renameClientRow,
  type PaymentInput,
} from '@shared/db/repos/clients'
import { listSalesForClient } from '@shared/db/repos/tandas'
import type { ClientSummary, PaymentWithContext, SaleWithDetails } from '@shared/db/types'
import { foldText } from '@shared/domain/text'

export const useClientsStore = defineStore('clients', () => {
  const clients = computed<ClientSummary[]>(() => {
    // Balances combine sales and payments.
    track('clients', 'sales', 'payments')
    return listClients()
  })

  const receivables = computed(() =>
    clients.value.filter((client) => client.balance > 0).sort((a, b) => b.balance - a.balance),
  )

  const totalOwed = computed(() =>
    receivables.value.reduce((sum, client) => sum + client.balance, 0),
  )

  function addClient(name: string): string {
    return createClient(name)
  }

  /** Fix a typo in a client's name; sales and payments stay attached by id. */
  function renameClient(id: string, name: string): { ok: true } | { ok: false; error: string } {
    const value = name.trim()
    if (value === '') return { ok: false, error: 'Enter a name.' }
    renameClientRow(id, value)
    return { ok: true }
  }

  /** Another client already called `name` (ignoring accents and case), or null. */
  function nameTakenBy(name: string, exceptId: string): ClientSummary | null {
    const folded = foldText(name)
    return (
      clients.value.find((client) => client.id !== exceptId && foldText(client.name) === folded) ??
      null
    )
  }

  /** Why a client cannot be deleted (checked before asking to confirm), or null. */
  function removalBlocker(id: string): string | null {
    return clientInUse(id) ? 'This client has sales or payments — it cannot be deleted.' : null
  }

  function removeClient(id: string): { ok: true } | { ok: false; error: string } {
    const blocker = removalBlocker(id)
    if (blocker) return { ok: false, error: blocker }
    deleteClient(id)
    return { ok: true }
  }

  function summaryFor(clientId: string): ClientSummary | null {
    track('clients', 'sales', 'payments')
    return listClients().find((client) => client.id === clientId) ?? null
  }

  function salesFor(clientId: string): SaleWithDetails[] {
    track('sales', 'payments', 'clients', 'products')
    return listSalesForClient(clientId)
  }

  function paymentsFor(clientId?: string): PaymentWithContext[] {
    // Payment rows show the client and the tanda of their sale.
    track('payments', 'clients', 'sales', 'tandas')
    return listPayments(clientId)
  }

  function pay(input: PaymentInput): string {
    return addPayment(input)
  }

  function removePayment(id: string): void {
    deletePayment(id)
  }

  return {
    clients,
    receivables,
    totalOwed,
    addClient,
    renameClient,
    nameTakenBy,
    removalBlocker,
    removeClient,
    summaryFor,
    salesFor,
    paymentsFor,
    pay,
    removePayment,
  }
})
