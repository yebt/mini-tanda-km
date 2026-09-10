import { computed } from 'vue'
import { defineStore } from 'pinia'

import { dbVersion } from '@shared/db/database'
import {
  addPayment,
  createClient,
  deletePayment,
  listClients,
  listPayments,
  type PaymentInput,
} from '@shared/db/repos/clients'
import { listSalesForClient } from '@shared/db/repos/tandas'
import type { ClientSummary, PaymentWithContext, SaleWithDetails } from '@shared/db/types'

export const useClientsStore = defineStore('clients', () => {
  const clients = computed<ClientSummary[]>(() => {
    void dbVersion.value
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

  function summaryFor(clientId: string): ClientSummary | null {
    void dbVersion.value
    return listClients().find((client) => client.id === clientId) ?? null
  }

  function salesFor(clientId: string): SaleWithDetails[] {
    void dbVersion.value
    return listSalesForClient(clientId)
  }

  function paymentsFor(clientId?: string): PaymentWithContext[] {
    void dbVersion.value
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
    summaryFor,
    salesFor,
    paymentsFor,
    pay,
    removePayment,
  }
})
