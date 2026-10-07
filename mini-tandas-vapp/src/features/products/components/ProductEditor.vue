<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'

import { useProductsStore } from '@shared/stores/products'
import { confirmDialog } from '@shared/ui/useConfirm'
import { usePageTitle } from '@shared/ui/usePageTitle'

import ProductForm from './ProductForm.vue'

const props = defineProps<{
  /** Product shown by `/products/:id`, or null for `/products/new`. */
  productId: string | null
}>()

const LIST_PATH = '/products'

const route = useRoute()
const router = useRouter()
const store = useProductsStore()

const product = computed(() =>
  props.productId === null
    ? null
    : (store.catalog.find((entry) => entry.product.id === props.productId)?.product ?? null),
)
const notFound = computed(() => props.productId !== null && product.value === null)

usePageTitle(() => (props.productId === null ? 'New product' : product.value?.name))

type Tab = 'general' | 'variations'

/** The active section lives in `?tab=` so reload and Back keep it. */
const tab = computed<Tab>({
  get: () => (route.query.tab === 'variations' ? 'variations' : 'general'),
  set: (value) => {
    void router.replace({ query: { ...route.query, tab: value === 'general' ? undefined : value } })
  },
})

/** After the first save the product gets its own URL, on its pricing tab. */
function onSaved(id: string) {
  if (props.productId === null) {
    void router.replace({ path: `${LIST_PATH}/${id}`, query: { tab: 'variations' } })
  }
}

/** Cancel / Done: back to the list, reusing its history entry when we came from it. */
function leave() {
  const back = (window.history.state as { back?: string | null } | null)?.back
  if (back?.split('?')[0] === LIST_PATH) router.back()
  else void router.push(LIST_PATH)
}

const form = useTemplateRef<{ hasUnsavedChanges: () => boolean }>('form')
const isDirty = () => form.value?.hasUnsavedChanges() ?? false

// Unsaved General fields: ask before any in-app navigation (Back, nav links)…
onBeforeRouteLeave(async () => {
  if (!isDirty()) return true
  return confirmDialog('Discard unsaved changes to this product?', 'Discard changes', {
    tone: 'danger',
  })
})

// …and let the browser warn on reload or tab close.
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty()) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<template>
  <div v-if="notFound" class="card empty-state">
    <h1>Product not found</h1>
    <RouterLink :to="LIST_PATH">Back to products</RouterLink>
  </div>
  <ProductForm
    v-else
    ref="form"
    v-model:tab="tab"
    :initial="product"
    @saved="onSaved"
    @cancel="leave"
  />
</template>
