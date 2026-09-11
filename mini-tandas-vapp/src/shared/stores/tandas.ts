import { computed } from 'vue'
import { defineStore } from 'pinia'

import { dbVersion } from '@shared/db/database'
import {
  createSale,
  createTanda,
  deleteSale,
  listInventory,
  listSales,
  listTandas,
  setDelivered,
  setInventoryQuantity,
  setTandaStatus,
  updateSale,
  updateTanda,
  type CreateSaleResult,
  type SaleItemInput,
  type TandaInput,
} from '@shared/db/repos/tandas'
import type { InventoryEntry, SaleWithDetails, TandaStatus, TandaSummary } from '@shared/db/types'

export const useTandasStore = defineStore('tandas', () => {
  const tandas = computed<TandaSummary[]>(() => {
    void dbVersion.value
    return listTandas()
  })

  const activeTandas = computed(() =>
    tandas.value
      .filter((tanda) => tanda.status !== 'closed')
      .sort((a, b) => a.date.localeCompare(b.date)),
  )

  function addTanda(input: TandaInput): string {
    return createTanda(input)
  }

  function saveTanda(id: string, patch: Parameters<typeof updateTanda>[1]): void {
    updateTanda(id, patch)
  }

  function moveStatus(tandaId: string, status: TandaStatus): void {
    setTandaStatus(tandaId, status)
  }

  function salesFor(tandaId: string): SaleWithDetails[] {
    void dbVersion.value
    return listSales(tandaId)
  }

  function inventoryFor(tandaId: string): InventoryEntry[] {
    void dbVersion.value
    return listInventory(tandaId)
  }

  function setStock(tandaId: string, skuId: string, quantity: number): void {
    setInventoryQuantity(tandaId, skuId, quantity)
  }

  function addSale(input: {
    tandaId: string
    clientId: string
    items: SaleItemInput[]
  }): CreateSaleResult {
    return createSale(input)
  }

  function toggleDelivered(saleId: string, delivered: boolean): void {
    setDelivered(saleId, delivered)
  }

  function editSale(saleId: string, items: SaleItemInput[]): CreateSaleResult {
    return updateSale(saleId, items)
  }

  function removeSale(saleId: string): void {
    deleteSale(saleId)
  }

  return {
    tandas,
    activeTandas,
    addTanda,
    saveTanda,
    moveStatus,
    salesFor,
    inventoryFor,
    setStock,
    addSale,
    toggleDelivered,
    editSale,
    removeSale,
  }
})
