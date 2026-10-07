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
  type PaymentInput,
} from '@shared/db/repos/clients'
import { listSalesForClient } from '@shared/db/repos/tandas'
import type { ClientSummary, PaymentWithContext, SaleWithDetails } from '@shared/db/types'

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
    removalBlocker,
    removeClient,
    summaryFor,
    salesFor,
    paymentsFor,
    pay,
    removePayment,
  }
})
