<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { canSell as tandaCanSell } from '@shared/domain/tanda'
import { useTandasStore } from '@shared/stores/tandas'
import type { SaleWithDetails } from '@shared/db/types'
import TabList, { panelId, tabId } from '@shared/ui/TabList.vue'
import { usePageTitle } from '@shared/ui/usePageTitle'
import TandaHeader from '@/features/tandas/components/TandaHeader.vue'
import StatusFlow from '@/features/tandas/components/StatusFlow.vue'
import InventoryEditor from '@/features/tandas/components/InventoryEditor.vue'
import SaleDialog from '@/features/tandas/components/SaleDialog.vue'
import SaleList from '@/features/tandas/components/SaleList.vue'

const route = useRoute('/tandas/[id]')
const router = useRouter()
const tandasStore = useTandasStore()

const tanda = computed(() => tandasStore.tandas.find((t) => t.id === route.params.id) ?? null)

usePageTitle(() => tanda.value?.name)

/**
 * Scheduled tandas take pre-orders while open; anticipated tandas sell
 * against the batch inventory once production is done (ready).
 */
const canSell = computed(() => (tanda.value ? tandaCanSell(tanda.value) : false))

type Tab = 'sales' | 'inventory'

/** Only anticipated tandas have an inventory, so only they get tabs. */
const hasTabs = computed(() => tanda.value?.type === 'anticipated')

const TABS = [
  { value: 'sales', label: 'Sales' },
  { value: 'inventory', label: 'Inventory' },
] as const

/** The active tab lives in `?tab=` so reload and back keep the view. */
const tab = computed<Tab>({
  get: () => (hasTabs.value && route.query.tab === 'inventory' ? 'inventory' : 'sales'),
  set: (value) => {
    void router.replace({ query: { ...route.query, tab: value === 'sales' ? undefined : value } })
  },
})

function onTabChange(value: string) {
  tab.value = value === 'inventory' ? 'inventory' : 'sales'
}

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

    <TabList
      v-if="hasTabs"
      :tabs="TABS"
      :model-value="tab"
      id-base="tanda"
      label="Tanda views"
      @update:model-value="onTabChange"
    />

    <div
      v-if="tab === 'sales'"
      :id="hasTabs ? panelId('tanda', 'sales') : undefined"
      :role="hasTabs ? 'tabpanel' : undefined"
      :aria-labelledby="hasTabs ? tabId('tanda', 'sales') : undefined"
    >
      <div class="sales-toolbar">
        <button v-if="canSell" type="button" class="btn btn-primary" @click="openSaleDialog()">
          New sale
        </button>
      </div>
      <SaleList :tanda="tanda" :hide-heading="hasTabs" @edit="openSaleEdit" />
    </div>

    <div
      v-else
      :id="panelId('tanda', 'inventory')"
      role="tabpanel"
      :aria-labelledby="tabId('tanda', 'inventory')"
    >
      <InventoryEditor :tanda="tanda" :sellable="canSell" @sell="openSaleDialog" />
    </div>

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
.sales-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}
</style>
