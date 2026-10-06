<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'

import { parseMoneyInput } from '@shared/db/money'
import { useProductsStore } from '@shared/stores/products'
import type { PriceMode, Product } from '@shared/db/types'
import { notify } from '@shared/ui/useToast'

import { createThumbnail } from '../lib/thumbnail'

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
/** True once the user picked or removed a photo; untouched photos are not re-sent. */
const photoChanged = ref(false)
/** Thumbnail being generated for a newly picked photo. */
let pendingThumbnail: Promise<string | null> = Promise.resolve(null)
const priceMode = ref<PriceMode>('global')
const price = ref('')
/** Field-level errors, tied to their inputs with aria-describedby. */
const nameError = ref('')
const priceError = ref('')
const photoError = ref('')
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
const priceInput = useTemplateRef<HTMLInputElement>('priceInput')

watch(
  () => props.initial,
  (product) => {
    name.value = product?.name ?? ''
    description.value = product?.description ?? ''
    // Only the editor loads the full photo; lists use the thumbnail.
    photo.value = product ? store.photoFor(product.id) : null
    photoChanged.value = false
    pendingThumbnail = Promise.resolve(null)
    priceMode.value = product?.priceMode ?? 'global'
    price.value = product?.price == null ? '' : String(product.price)
    nameError.value = ''
    priceError.value = ''
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
    const picked = typeof reader.result === 'string' ? reader.result : null
    photo.value = picked
    photoChanged.value = true
    pendingThumbnail = picked ? createThumbnail(picked) : Promise.resolve(null)
  }
  reader.readAsDataURL(file)
}

function removePhoto() {
  photo.value = null
  photoChanged.value = true
  pendingThumbnail = Promise.resolve(null)
}

async function submit() {
  const trimmedName = name.value.trim()
  const parsedPrice = parseMoneyInput(price.value)
  nameError.value = trimmedName ? '' : 'Name is required.'
  priceError.value =
    priceMode.value === 'global' && parsedPrice !== null && Number.isNaN(parsedPrice)
      ? 'Enter a valid price (0 or more), or leave it empty.'
      : ''
  // Focus the first invalid field so the error is found and fixed in place.
  if (nameError.value) {
    nameInput.value?.focus()
    return
  }
  if (priceError.value) {
    priceInput.value?.focus()
    return
  }
  const isNew = !props.initial
  // A missing thumbnail (e.g. undecodable image) is generated later by the backfill.
  const thumbnail = photoChanged.value && photo.value ? await pendingThumbnail : null
  // Keep sending only the general fields — omitting `priceVariationIds`
  // preserves the pricing subset chosen in the Variations & pricing tab.
  const id = store.saveProduct({
    id: props.initial?.id,
    name: trimmedName,
    description: description.value.trim() || null,
    ...(photoChanged.value ? { photo: photo.value, thumbnail } : {}),
    priceMode: priceMode.value,
    price: priceMode.value === 'global' ? parsedPrice : null,
  })
  notify(isNew ? `"${trimmedName}" created.` : `"${trimmedName}" saved.`)
  emit('saved', id)
}
</script>

<template>
  <form class="general-tab" @submit.prevent="submit">
    <div class="field">
      <label class="label" for="product-name">Name</label>
      <input
        id="product-name"
        ref="nameInput"
        v-model="name"
        type="text"
        class="input"
        name="product-name"
        autocomplete="off"
        aria-required="true"
        :aria-invalid="nameError ? 'true' : undefined"
        :aria-describedby="nameError ? 'product-name-error' : undefined"
      />
      <p v-if="nameError" id="product-name-error" class="error-text" role="alert">
        {{ nameError }}
      </p>
    </div>

    <div class="field">
      <label class="label" for="product-description">Description</label>
      <textarea id="product-description" v-model="description" class="textarea" rows="2" />
    </div>

    <div class="field">
      <label class="label" for="product-photo">Photo</label>
      <div v-if="photo" class="row photo-preview">
        <img :src="photo" alt="Product photo preview" />
        <button type="button" class="btn btn-ghost" @click="removePhoto">Remove photo</button>
      </div>
      <input
        id="product-photo"
        type="file"
        accept="image/*"
        class="input"
        :aria-invalid="photoError ? 'true' : undefined"
        :aria-describedby="photoError ? 'product-photo-error' : undefined"
        @change="onPhotoChange"
      />
      <p v-if="photoError" id="product-photo-error" class="error-text" role="alert">
        {{ photoError }}
      </p>
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
      <input
        id="product-price"
        ref="priceInput"
        v-model="price"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        class="input"
        placeholder="e.g. 120.00…"
        :aria-invalid="priceError ? 'true' : undefined"
        :aria-describedby="priceError ? 'product-price-error' : undefined"
      />
      <p v-if="priceError" id="product-price-error" class="error-text" role="alert">
        {{ priceError }}
      </p>
    </div>
    <p v-else class="muted">Prices are set per SKU once variations are added.</p>

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
