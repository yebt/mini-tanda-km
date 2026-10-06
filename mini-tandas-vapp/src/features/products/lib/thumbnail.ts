import {
  getProductPhoto,
  listProductsMissingThumbnail,
  setProductThumbnails,
} from '@shared/db/repos/products'
import { whenIdle } from '@shared/ui/whenIdle'

/** Edge of the square list thumbnail, in px (2× the largest list preview). */
export const THUMBNAIL_SIZE = 160
const THUMBNAIL_QUALITY = 0.8
const IMAGE_LOAD_TIMEOUT_MS = 5000

export interface CropRect {
  x: number
  y: number
  size: number
}

/** Centered square of the source image, so the thumbnail fills its box like `object-fit: cover`. */
export function coverCropRect(width: number, height: number): CropRect {
  const size = Math.min(width, height)
  return {
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
    size,
  }
}

function canvasAvailable(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof Image !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    // jsdom defines canvas elements without a drawing context.
    !/jsdom/i.test(typeof navigator === 'undefined' ? '' : navigator.userAgent)
  )
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    const timer = setTimeout(() => resolve(null), IMAGE_LOAD_TIMEOUT_MS)
    image.onload = () => {
      clearTimeout(timer)
      resolve(image)
    }
    image.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    image.src = src
  })
}

/**
 * Small square preview (WebP, JPEG where WebP encoding is unsupported) of a
 * photo data URL. Resolves null when the image cannot be decoded or there is
 * no canvas (Node, tests) — callers keep working without a thumbnail.
 */
export async function createThumbnail(
  photo: string,
  size: number = THUMBNAIL_SIZE,
): Promise<string | null> {
  if (!canvasAvailable()) return null
  const image = await loadImage(photo)
  if (!image || image.naturalWidth === 0 || image.naturalHeight === 0) return null
  const canvas = document.createElement('canvas')
  const crop = coverCropRect(image.naturalWidth, image.naturalHeight)
  const edge = Math.min(size, crop.size)
  canvas.width = edge
  canvas.height = edge
  const context = canvas.getContext('2d')
  if (!context) return null
  // Opaque background: transparent PNGs stay readable once encoded lossy.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, edge, edge)
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, edge, edge)
  const webp = canvas.toDataURL('image/webp', THUMBNAIL_QUALITY)
  return webp.startsWith('data:image/webp')
    ? webp
    : canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY)
}

export type ThumbnailMaker = (photo: string) => Promise<string | null>

/**
 * Generate thumbnails for products that have a photo but none yet (photos
 * migrated from older versions or restored from older backups). All results
 * are stored with one write. Returns how many thumbnails were stored.
 */
export async function backfillThumbnails(make: ThumbnailMaker = createThumbnail): Promise<number> {
  const generated = new Map<string, string>()
  for (const productId of listProductsMissingThumbnail()) {
    const photo = getProductPhoto(productId)
    if (!photo) continue
    const thumbnail = await make(photo)
    if (thumbnail) generated.set(productId, thumbnail)
  }
  // A product deleted while thumbnails were generated is simply not updated.
  setProductThumbnails(generated)
  return generated.size
}

/** Browser startup hook: backfill missing thumbnails once the app is idle. */
export function scheduleThumbnailBackfill(): void {
  if (!canvasAvailable()) return
  whenIdle(() => {
    backfillThumbnails().catch((error: unknown) => console.error(error))
  })
}
