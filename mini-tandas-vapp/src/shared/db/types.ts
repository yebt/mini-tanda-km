export type PriceMode = 'global' | 'per_sku'

export interface VariationOption {
  id: string
  label: string
}

export interface Variation {
  id: string
  name: string
  options: VariationOption[]
}

export interface Product {
  id: string
  name: string
  description: string | null
  photo: string | null
  priceMode: PriceMode
  /** Global price — set when priceMode is 'global' or the product has no variations. */
  price: number | null
  variations: Variation[]
}

export interface Sku {
  id: string
  productId: string
  /** Option ids defining this combination (sorted for a stable key). */
  optionIds: string[]
  /** Per-SKU price — used when the product's priceMode is 'per_sku'. */
  price: number | null
}

export type TandaType = 'scheduled' | 'anticipated'
export type TandaStatus = 'open' | 'production' | 'ready' | 'closed'

export const TANDA_STATUS_ORDER: TandaStatus[] = ['open', 'production', 'ready', 'closed']

export interface Tanda {
  id: string
  name: string
  /** Scheduled date, YYYY-MM-DD. */
  date: string
  type: TandaType
  status: TandaStatus
  createdAt: string
}

export interface Client {
  id: string
  name: string
  createdAt: string
}

export interface SaleItem {
  id: string
  saleId: string
  skuId: string
  quantity: number
  unitPrice: number
}

export interface Sale {
  id: string
  tandaId: string
  clientId: string
  delivered: boolean
  createdAt: string
}

export interface Payment {
  id: string
  clientId: string
  saleId: string | null
  amount: number
  note: string | null
  createdAt: string
}

// ── Derived/read-model types ──────────────────────────────────────────────

export interface SaleLine {
  skuId: string
  label: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface SaleWithDetails extends Sale {
  client: Client
  items: SaleLine[]
  total: number
  /** Payments allocated to this sale specifically. */
  paid: number
  balance: number
}

export interface InventoryEntry {
  sku: Sku
  productName: string
  label: string
  produced: number
  sold: number
  available: number
}

export interface TandaSummary extends Tanda {
  saleCount: number
  revenue: number
  /** Sum of unpaid sale balances (general abonos do not reduce this). */
  pendingBalance: number
}

export interface ClientSummary extends Client {
  totalSales: number
  totalPayments: number
  /** Positive = client owes money. */
  balance: number
}

export interface PaymentWithContext extends Payment {
  clientName: string
  /** Sale label when the payment is allocated to a sale. */
  saleLabel: string | null
}

export interface SkuWithProduct extends Sku {
  productName: string
  label: string
  price: number | null
}

/** Effective price for a SKU given the product's price mode. */
export function priceForSku(
  product: Pick<Product, 'priceMode' | 'price'>,
  sku: Pick<Sku, 'price'>,
): number | null {
  return product.priceMode === 'global' ? product.price : sku.price
}

export function skuLabel(
  product: Pick<Product, 'variations'>,
  sku: Pick<Sku, 'optionIds'>,
): string {
  const labels: string[] = []
  for (const variation of product.variations) {
    const option = variation.options.find((o) => sku.optionIds.includes(o.id))
    if (option) labels.push(option.label)
  }
  return labels.join(' · ')
}
