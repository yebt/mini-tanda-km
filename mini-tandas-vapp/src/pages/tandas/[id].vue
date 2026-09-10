<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useTandasStore } from '@shared/stores/tandas'
import TandaHeader from '@/features/tandas/components/TandaHeader.vue'
import StatusFlow from '@/features/tandas/components/StatusFlow.vue'
import InventoryEditor from '@/features/tandas/components/InventoryEditor.vue'
import SaleForm from '@/features/tandas/components/SaleForm.vue'
import SaleList from '@/features/tandas/components/SaleList.vue'

const route = useRoute('/tandas/[id]')
const tandasStore = useTandasStore()

const tanda = computed(() => tandasStore.tandas.find((t) => t.id === route.params.id) ?? null)
</script>

<template>
  <div v-if="!tanda" class="card empty-state">
    <p>Tanda not found.</p>
    <RouterLink to="/tandas">Back to tandas</RouterLink>
  </div>

  <template v-else>
    <TandaHeader :tanda="tanda" />
    <StatusFlow :tanda="tanda" />
    <InventoryEditor v-if="tanda.type === 'anticipated'" :tanda="tanda" />
    <SaleForm v-if="tanda.status === 'open'" :tanda-id="tanda.id" :type="tanda.type" />
    <SaleList :tanda-id="tanda.id" :status="tanda.status" />
  </template>
</template>
