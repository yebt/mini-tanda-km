<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import ClientSalesList from '@/features/clients/components/ClientSalesList.vue'
import ClientSummaryCard from '@/features/clients/components/ClientSummaryCard.vue'
import PaymentForm from '@/features/clients/components/PaymentForm.vue'
import PaymentList from '@/features/clients/components/PaymentList.vue'
import { useClientsStore } from '@shared/stores/clients'

const route = useRoute('/clients/[id]')

const clientsStore = useClientsStore()

const summary = computed(() => clientsStore.summaryFor(route.params.id))
</script>

<template>
  <p v-if="!summary" class="empty-state">
    Client not found. <RouterLink to="/clients">Back to clients</RouterLink>
  </p>
  <template v-else>
    <ClientSummaryCard :summary="summary" />

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
