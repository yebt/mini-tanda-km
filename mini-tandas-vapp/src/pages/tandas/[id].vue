<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useTandasStore } from '@shared/stores/tandas'
import type { SaleWithDetails } from '@shared/db/types'
import TandaHeader from '@/features/tandas/components/TandaHeader.vue'
import StatusFlow from '@/features/tandas/components/StatusFlow.vue'
import InventoryEditor from '@/features/tandas/components/InventoryEditor.vue'
import SaleDialog from '@/features/tandas/components/SaleDialog.vue'
import SaleList from '@/features/tandas/components/SaleList.vue'

const route = useRoute('/tandas/[id]')
const tandasStore = useTandasStore()

const tanda = computed(() => tandasStore.tandas.find((t) => t.id === route.params.id) ?? null)

/**
 * Scheduled tandas take pre-orders while open; anticipated tandas sell
 * against the batch inventory once production is done (ready).
 */
const canSell = computed(() => {
  if (!tanda.value) return false
  return tanda.value.type === 'scheduled'
    ? tanda.value.status === 'open'
    : tanda.value.status === 'ready'
})

type Tab = 'sales' | 'inventory'
const tab = ref<Tab>('sales')

/** Sale dialog state; initialSkuId pre-selects a SKU when sold from inventory. */
const dialogInitialSku = ref<string | undefined>(undefined)
/** Sale being edited, if the dialog was opened from a sale card. */
const dialogInitialSale = ref<SaleWithDetails | undefined>(undefined)
const dialogOpen = ref(false)

function openSaleDialog(skuId?: string) {
  dialogInitialSale.value = undefined
  dialogInitialSku.value = skuId
  dialogOpen.value = true
}

function openSaleEdit(sale: SaleWithDetails) {
  dialogInitialSku.value = undefined
  dialogInitialSale.value = sale
  dialogOpen.value = true
}

function closeSaleDialog() {
  dialogOpen.value = false
  dialogInitialSku.value = undefined
  dialogInitialSale.value = undefined
}
</script>

<template>
  <div v-if="!tanda" class="card empty-state">
    <p>Tanda not found.</p>
    <RouterLink to="/tandas">Back to tandas</RouterLink>
  </div>

  <template v-else>
    <TandaHeader :tanda="tanda" />
    <StatusFlow :tanda="tanda" />

    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="tab"
        :class="{ 'is-active': tab === 'sales' }"
        :aria-selected="tab === 'sales'"
        @click="tab = 'sales'"
      >
        Sales
      </button>
      <button
        v-if="tanda.type === 'anticipated'"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'is-active': tab === 'inventory' }"
        :aria-selected="tab === 'inventory'"
        @click="tab = 'inventory'"
      >
        Inventory
      </button>
    </div>

    <template v-if="tab === 'sales'">
      <div class="sales-toolbar">
        <button v-if="canSell" type="button" class="btn btn-primary" @click="openSaleDialog()">
          New sale
        </button>
      </div>
      <SaleList :tanda-id="tanda.id" :status="tanda.status" @edit="openSaleEdit" />
    </template>

    <InventoryEditor v-else :tanda="tanda" :sellable="canSell" @sell="openSaleDialog" />

    <button
      v-if="canSell"
      type="button"
      class="fab mobile-only"
      aria-label="New sale"
      @click="openSaleDialog()"
    >
      +
    </button>

    <SaleDialog
      v-if="dialogOpen"
      :tanda-id="tanda.id"
      :type="tanda.type"
      :initial-sku-id="dialogInitialSku"
      :initial-sale="dialogInitialSale"
      @close="closeSaleDialog"
    />
  </template>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-4);
}

.tab {
  border: none;
  background: transparent;
  padding: var(--space-2) var(--space-3);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-ink-soft);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.tab:hover {
  color: var(--color-primary);
}

.tab.is-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.sales-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}
</style>
