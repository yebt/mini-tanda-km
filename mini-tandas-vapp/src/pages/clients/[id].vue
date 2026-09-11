<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ClientSalesList from '@/features/clients/components/ClientSalesList.vue'
import ClientSummaryCard from '@/features/clients/components/ClientSummaryCard.vue'
import PaymentForm from '@/features/clients/components/PaymentForm.vue'
import PaymentList from '@/features/clients/components/PaymentList.vue'
import { useClientsStore } from '@shared/stores/clients'
import { confirmDialog } from '@shared/ui/useConfirm'

const route = useRoute('/clients/[id]')
const router = useRouter()

const clientsStore = useClientsStore()

const summary = computed(() => clientsStore.summaryFor(route.params.id))

const actionError = ref('')

async function remove(): Promise<void> {
  if (!summary.value) return
  actionError.value = ''
  if (await confirmDialog(`Delete "${summary.value.name}"?`, 'Delete')) {
    const result = clientsStore.removeClient(summary.value.id)
    if (!result.ok) {
      actionError.value = result.error
      return
    }
    router.push('/clients')
  }
}
</script>

<template>
  <p v-if="!summary" class="empty-state">
    Client not found. <RouterLink to="/clients">Back to clients</RouterLink>
  </p>
  <template v-else>
    <ClientSummaryCard :summary="summary" @remove="remove" />
    <p v-if="actionError" class="error-text">{{ actionError }}</p>

    <section class="card">
      <h2>Record payment</h2>
      <PaymentForm :client-id="summary.id" />
    </section>

    <section class="card">
      <h2>Sales</h2>
      <ClientSalesList :client-id="summary.id" />
    </section>

    <section class="card">
      <h2>Payments</h2>
      <PaymentList :client-id="summary.id" />
    </section>
  </template>
</template>
