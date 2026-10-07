<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { ImagePlus, Trash2 } from 'lucide-vue-next'

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

const PRICE_MODES: { value: PriceMode; title: string; description: string }[] = [
  { value: 'global', title: 'Global price', description: 'One price for the whole product' },
  {
    value: 'per_sku',
    title: 'Price per SKU',
    description: 'A price for each variation combination',
  },
]

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

/** Hint and error both describe the file input. */
const photoDescribedBy = computed(() =>
  photoError.value ? 'product-photo-hint product-photo-error' : 'product-photo-hint',
)
/** True while an image is dragged over the preview tile. */
const dragging = ref(false)

function onPhotoChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) acceptPhoto(file)
}

function onPhotoDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) acceptPhoto(file)
}

function acceptPhoto(file: File) {
  if (!file.type.startsWith('image/')) {
    photoError.value = 'That file is not an image — choose a JPG, PNG or WebP.'
    return
  }
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
      <div class="photo-picker">
        <div
          class="photo-tile"
          :class="{ 'is-empty': !photo, 'is-dragging': dragging }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onPhotoDrop"
        >
          <img
            v-if="photo"
            :src="photo"
            alt="Product photo preview"
            width="72"
            height="72"
            decoding="async"
          />
          <ImagePlus v-else :size="26" :stroke-width="1.75" aria-hidden="true" />
        </div>
        <div class="photo-body">
          <div class="photo-actions">
            <input
              id="product-photo"
              type="file"
              accept="image/*"
              class="photo-input visually-hidden"
              :aria-invalid="photoError ? 'true' : undefined"
              :aria-describedby="photoDescribedBy"
              @change="onPhotoChange"
            />
            <label for="product-photo" class="btn photo-choose">
              {{ photo ? 'Change photo' : 'Choose photo' }}
            </label>
            <button v-if="photo" type="button" class="btn btn-ghost photo-remove" @click="removePhoto">
              <Trash2 :size="16" aria-hidden="true" />
              Remove<span class="visually-hidden"> photo</span>
            </button>
          </div>
          <p id="product-photo-hint" class="muted photo-hint">
            JPG, PNG or WebP · up to 1 MB
          </p>
        </div>
      </div>
      <p v-if="photoError" id="product-photo-error" class="error-text" role="alert">
        {{ photoError }}
      </p>
    </div>

    <fieldset class="choice-group">
      <legend class="label">Price mode</legend>
      <div class="choice-grid">
        <label v-for="mode in PRICE_MODES" :key="mode.value" class="choice-card">
          <input
            v-model="priceMode"
            type="radio"
            name="price-mode"
            class="choice-input"
            :value="mode.value"
            :aria-labelledby="`price-mode-${mode.value}-title`"
            :aria-describedby="`price-mode-${mode.value}-desc`"
          />
          <span class="choice-text">
            <span :id="`price-mode-${mode.value}-title`" class="choice-title">
              {{ mode.title }}
            </span>
            <span :id="`price-mode-${mode.value}-desc`" class="choice-desc">
              {{ mode.description }}
            </span>
          </span>
        </label>
      </div>
    </fieldset>

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
/* ── Photo picker: preview tile + choose/change + remove ──────────────── */
.photo-picker {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.photo-tile {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
  background: var(--color-bg);
  color: var(--color-ink-soft);
  transition:
    border-color 0.15s ease-out,
    background-color 0.15s ease-out;
}

.photo-tile.is-empty {
  border: 1.5px dashed var(--color-control-border);
}

.photo-tile.is-dragging {
  border: 1.5px dashed var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-ink);
}

.photo-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-body {
  min-width: 0;
}

.photo-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

/* The visible "button" is the input's label; it shows the input's focus. */
.photo-input:focus-visible + .photo-choose {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.photo-choose {
  border-color: var(--color-control-border);
}

.photo-remove {
  color: var(--color-ink-soft);
}

.photo-remove:hover {
  color: var(--color-danger);
}

.photo-hint {
  margin: var(--space-2) 0 0;
  font-size: 0.8rem;
}

.price-field {
  max-width: 220px;
}

.form-actions {
  margin-top: var(--space-4);
}
</style>
