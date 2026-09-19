import type { EntityManager } from '@mikro-orm/postgresql'
import { CatalogProduct, CatalogProductVariant } from '../../../catalog/data/entities'
import type { SalesDocumentKind } from '../types'
import type {
  TaxAddress,
  TaxCustomer,
  TaxDocumentContext,
  TaxDocumentIntent,
  TaxProductFacts,
  TaxProviderSelection,
} from './types'

export const DEFAULT_TAX_PROVIDER_KEY = 'table-rates'
export const DEFAULT_TAX_PROVIDER_TIMEOUT_MS = 8000

const MIN_TAX_PROVIDER_TIMEOUT_MS = 1000
const MAX_TAX_PROVIDER_TIMEOUT_MS = 30_000

/** Documents core recalculates are estimates; the ones that take caller totals are records. */
const RECORD_DOCUMENT_KINDS: ReadonlySet<SalesDocumentKind> = new Set([
  'invoice',
  'credit_memo',
] as SalesDocumentKind[])

export type TaxContextLineInput = {
  productId?: string | null
  productVariantId?: string | null
  catalogSnapshot?: Record<string, unknown> | null
}

export type ResolveTaxDocumentContextParams = {
  em: EntityManager
  organizationId: string
  tenantId: string
  documentKind: SalesDocumentKind
  documentId?: string | null
  documentNumber?: string | null
  documentDate?: Date | string | null
  channelId?: string | null
  customerSnapshot?: Record<string, unknown> | null
  billingAddressSnapshot?: Record<string, unknown> | null
  shippingAddressSnapshot?: Record<string, unknown> | null
  lines?: TaxContextLineInput[]
  totalsMode?: 'computed' | 'external'
  metadata?: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export function resolveTaxDocumentIntent(documentKind: SalesDocumentKind): TaxDocumentIntent {
  return RECORD_DOCUMENT_KINDS.has(documentKind) ? 'record' : 'estimate'
}

export function clampTaxProviderTimeout(value: unknown): number {
  const parsed = asNumber(value)
  if (parsed === null) return DEFAULT_TAX_PROVIDER_TIMEOUT_MS
  return Math.min(MAX_TAX_PROVIDER_TIMEOUT_MS, Math.max(MIN_TAX_PROVIDER_TIMEOUT_MS, Math.round(parsed)))
}

/** The instance-wide default; a per organization setting overrides it from Phase 3. */
export function resolveDefaultTaxProviderTimeout(): number {
  const fromEnv = process.env.OM_SALES_TAX_PROVIDER_TIMEOUT_MS
  return fromEnv === undefined || fromEnv === '' ? DEFAULT_TAX_PROVIDER_TIMEOUT_MS : clampTaxProviderTimeout(fromEnv)
}

/** Maps an address snapshot written by `resolveAddressSnapshot` onto the contract shape. */
export function toTaxAddress(snapshot: unknown): TaxAddress | null {
  const record = asRecord(snapshot)
  if (!record) return null
  return {
    line1: asString(record.addressLine1 ?? record.line1),
    line2: asString(record.addressLine2 ?? record.line2),
    buildingNumber: asString(record.buildingNumber),
    flatNumber: asString(record.flatNumber),
    city: asString(record.city),
    region: asString(record.region),
    postalCode: asString(record.postalCode),
    country: asString(record.country),
    latitude: asNumber(record.latitude),
    longitude: asNumber(record.longitude),
  }
}

/**
 * Builds the customer block from the persisted customer snapshot. The tax
 * identifier lives on the billing address snapshot (spec
 * 2026-08-10-address-contact-and-tax-fields) and is `null` until that lands.
 */
export function toTaxCustomer(
  customerSnapshot: unknown,
  billingAddressSnapshot: unknown
): TaxCustomer | null {
  const snapshot = asRecord(customerSnapshot)
  const customer = asRecord(snapshot?.customer)
  const id = asString(customer?.id)
  if (!id) return null
  const billing = asRecord(billingAddressSnapshot)
  const kindValue = asString(customer?.kind)
  const exemption = asRecord(customer?.taxExemption)
  return {
    id,
    kind: kindValue === 'person' || kindValue === 'company' ? kindValue : null,
    code: id,
    displayName: asString(customer?.displayName),
    taxId: asString(billing?.taxId),
    taxIdType: asString(billing?.taxIdType),
    exemption: exemption
      ? {
          isExempt: asBoolean(exemption.isExempt),
          code: asString(exemption.code),
          certificateNumber: asString(exemption.certificateNumber),
        }
      : null,
  }
}

function factsFromCatalogSnapshot(snapshot: unknown): TaxProductFacts | null {
  const record = asRecord(snapshot)
  if (!record) return null
  const sku = asString(record.sku)
  const taxRateId = asString(record.taxRateId ?? record.tax_rate_id)
  const taxClassificationCode = asString(
    record.taxClassificationCode ?? record.tax_classification_code
  )
  const hsCode = asString(record.hsCode ?? record.hs_code)
  if (!sku && !taxRateId && !taxClassificationCode && !hsCode) return null
  return { sku, taxRateId, taxClassificationCode, hsCode }
}

/**
 * Loads the catalog tax facts the lines do not already carry. One batched read
 * per table, never one per line: a document with a thousand lines still costs
 * two queries.
 */
async function loadProductFacts(
  em: EntityManager,
  organizationId: string,
  tenantId: string,
  lines: TaxContextLineInput[]
): Promise<Record<string, TaxProductFacts>> {
  const facts: Record<string, TaxProductFacts> = {}
  const productIds = new Set<string>()
  const variantIds = new Set<string>()

  for (const line of lines) {
    const fromSnapshot = factsFromCatalogSnapshot(line.catalogSnapshot)
    const productId = asString(line.productId)
    const variantId = asString(line.productVariantId)
    if (fromSnapshot) {
      if (productId) facts[productId] = fromSnapshot
      if (variantId) facts[variantId] = fromSnapshot
      continue
    }
    if (productId) productIds.add(productId)
    if (variantId) variantIds.add(variantId)
  }

  if (productIds.size > 0) {
    const products = await em.find(CatalogProduct, {
      id: { $in: Array.from(productIds) },
      organizationId,
      tenantId,
    })
    for (const product of products) {
      facts[product.id] = {
        sku: asString(product.sku),
        taxRateId: asString(product.taxRateId),
        taxClassificationCode: asString(product.taxClassificationCode),
        hsCode: asString(product.hsCode),
      }
    }
  }

  if (variantIds.size > 0) {
    const variants = await em.find(CatalogProductVariant, {
      id: { $in: Array.from(variantIds) },
      organizationId,
      tenantId,
    })
    for (const variant of variants) {
      const parentId = (variant.product as { id?: string } | undefined)?.id ?? null
      const productFacts = parentId ? facts[parentId] : undefined
      facts[variant.id] = {
        sku: asString(variant.sku) ?? productFacts?.sku ?? null,
        taxRateId: asString(variant.taxRateId) ?? productFacts?.taxRateId ?? null,
        // Variants carry no classification code of their own; the product owns it.
        taxClassificationCode: productFacts?.taxClassificationCode ?? null,
        hsCode: asString(variant.hsCode) ?? productFacts?.hsCode ?? null,
      }
    }
  }

  return facts
}

function toIsoDate(value: Date | string | null | undefined): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return new Date().toISOString()
}

/**
 * Phase 1 selection: always the built in default. Phase 3 replaces this with
 * the per organization row, the integration state and the credentials closure.
 */
function resolveSelection(): TaxProviderSelection {
  return {
    providerKey: DEFAULT_TAX_PROVIDER_KEY,
    settings: {},
    integrationId: null,
    integrationEnabled: true,
  }
}

/**
 * Assembles everything the tax stage needs that only the command layer can look
 * up. It runs before `calculateDocumentTotals`, so every database read happens
 * outside the write transaction and the totals hook itself stays pure.
 */
export async function resolveTaxDocumentContext(
  params: ResolveTaxDocumentContextParams
): Promise<TaxDocumentContext> {
  const lines = params.lines ?? []
  const productFacts = await loadProductFacts(
    params.em,
    params.organizationId,
    params.tenantId,
    lines
  )

  return {
    document: {
      kind: params.documentKind,
      id: asString(params.documentId),
      number: asString(params.documentNumber),
      date: toIsoDate(params.documentDate),
      channelId: asString(params.channelId),
      intent: resolveTaxDocumentIntent(params.documentKind),
    },
    customer: toTaxCustomer(params.customerSnapshot, params.billingAddressSnapshot),
    addresses: {
      // Phase 3 fills this from `sales_settings.ship_from_address`.
      shipFrom: null,
      shipTo: toTaxAddress(params.shippingAddressSnapshot),
      billTo: toTaxAddress(params.billingAddressSnapshot),
    },
    productFacts,
    selection: resolveSelection(),
    // A closure, so credentials survive the hook and vanish in JSON.stringify.
    resolveCredentials: async () => ({}),
    timeoutMs: resolveDefaultTaxProviderTimeout(),
    totalsMode: params.totalsMode ?? 'computed',
    metadata: asRecord(params.metadata) ?? {},
  }
}
