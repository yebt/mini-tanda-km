<script setup lang="ts">
import { ref, watch } from 'vue'

import { useProductsStore } from '@shared/stores/products'
import type { PriceMode, Product } from '@shared/db/types'

const props = defineProps<{
  /** The product being edited, or null when creating a new one. */
  initial: Product | null
}>()

const emit = defineEmits<{
  saved: [id: string]
  cancel: []
}>()

const store = useProductsStore()

const MAX_PHOTO_BYTES = 1024 * 1024

const name = ref('')
const description = ref('')
const photo = ref<string | null>(null)
const priceMode = ref<PriceMode>('global')
const price = ref<string | number>('')
const formError = ref('')
const photoError = ref('')

watch(
  () => props.initial,
  (product) => {
    name.value = product?.name ?? ''
    description.value = product?.description ?? ''
    photo.value = product?.photo ?? null
    priceMode.value = product?.priceMode ?? 'global'
    price.value = product?.price == null ? '' : String(product.price)
    formError.value = ''
    photoError.value = ''
  },
  { immediate: true },
)

function onPhotoChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > MAX_PHOTO_BYTES) {
    photoError.value = 'Image is larger than 1 MB — choose a smaller file.'
    return
  }
  photoError.value = ''
  const reader = new FileReader()
  reader.onload = () => {
    photo.value = typeof reader.result === 'string' ? reader.result : null
  }
  reader.readAsDataURL(file)
}

function submit() {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    formError.value = 'Name is required.'
    return
  }
  // `v-model` on a number input may hand us a number already.
  const rawPrice = typeof price.value === 'number' ? String(price.value) : price.value.trim()
  const parsedPrice = rawPrice === '' ? null : Number(rawPrice)
  if (
    priceMode.value === 'global' &&
    parsedPrice !== null &&
    (!Number.isFinite(parsedPrice) || parsedPrice < 0)
  ) {
    formError.value = 'Enter a valid price (0 or more).'
    return
  }
  formError.value = ''
  // Keep sending only the general fields — omitting `priceVariationIds`
  // preserves the pricing subset chosen in the Variations & pricing tab.
  const id = store.saveProduct({
    id: props.initial?.id,
    name: trimmedName,
    description: description.value.trim() || null,
    photo: photo.value,
    priceMode: priceMode.value,
    price: priceMode.value === 'global' ? parsedPrice : null,
  })
  emit('saved', id)
}
</script>

<template>
  <form class="general-tab" @submit.prevent="submit">
    <div class="field">
      <label class="label" for="product-name">Name</label>
      <input id="product-name" v-model="name" type="text" class="input" required />
    </div>

    <div class="field">
      <label class="label" for="product-description">Description</label>
      <textarea id="product-description" v-model="description" class="textarea" rows="2" />
    </div>

    <div class="field">
      <span class="label">Photo</span>
      <div v-if="photo" class="row photo-preview">
        <img :src="photo" alt="Product photo preview" />
        <button type="button" class="btn btn-ghost" @click="photo = null">Remove photo</button>
      </div>
      <input type="file" accept="image/*" class="input" @change="onPhotoChange" />
      <p v-if="photoError" class="error-text">{{ photoError }}</p>
    </div>

    <div class="field">
      <span class="label">Price mode</span>
      <label class="radio-option">
        <input v-model="priceMode" type="radio" value="global" />
        <span> Global price <span class="muted">— one price for the whole product</span> </span>
      </label>
      <label class="radio-option">
        <input v-model="priceMode" type="radio" value="per_sku" />
        <span>
          Price per SKU <span class="muted">— a price for each variation combination</span>
        </span>
      </label>
    </div>

    <div v-if="priceMode === 'global'" class="field price-field">
      <label class="label" for="product-price">Price</label>
      <input id="product-price" v-model="price" type="number" min="0" step="0.01" class="input" />
    </div>
    <p v-else class="muted">Prices are set per SKU once variations are added.</p>

    <p v-if="formError" class="error-text">{{ formError }}</p>

    <div class="row form-actions">
      <button type="submit" class="btn btn-primary">
        {{ initial ? 'Save changes' : 'Create product' }}
      </button>
      <button type="button" class="btn btn-ghost" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.photo-preview {
  margin-bottom: var(--space-2);
}

.photo-preview img {
  width: 56px;
  height: 56px;
  border-radius: var(--radius);
  object-fit: cover;
  border: 1px solid var(--color-border);
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  cursor: pointer;
}

.radio-option input {
  margin-top: 0.2rem;
}

.price-field {
  max-width: 220px;
}

.form-actions {
  margin-top: var(--space-4);
}
</style>
