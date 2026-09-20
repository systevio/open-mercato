import { resolvePriceLabelKey, showsSinglePricePlusTax, taxLineLabelKey, taxNoteKey } from '@open-mercato/shared/lib/display/price'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'
import type { DocumentTotalItem } from './DocumentTotals'

export type DocumentTotalsRecord = {
  subtotalNetAmount?: number | null
  subtotalGrossAmount?: number | null
  discountTotalAmount?: number | null
  taxTotalAmount?: number | null
  shippingNetAmount?: number | null
  shippingGrossAmount?: number | null
  surchargeTotalAmount?: number | null
  grandTotalNetAmount?: number | null
  grandTotalGrossAmount?: number | null
  paidTotalAmount?: number | null
  refundedTotalAmount?: number | null
  outstandingAmount?: number | null
  taxStatus?: string | null
}

export type DocumentTotalsAdjustmentRow = {
  id: string
  amountNet?: number | null
  amountGross?: number | null
}

type Translate = (key: string, fallback?: string, params?: Record<string, unknown>) => string

export type BuildDocumentTotalsItemsParams = {
  record: DocumentTotalsRecord
  kind: 'order' | 'quote'
  profile?: DisplayProfile | null
  translate: Translate
  adjustments: DocumentTotalsAdjustmentRow[]
  adjustmentLabel: (row: DocumentTotalsAdjustmentRow) => string
}

function amount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isPresent(value: number | null | undefined): boolean {
  return amount(value) !== 0
}

/**
 * The amount the document's lines come to before any tax, discount, shipping or surcharge.
 *
 * The engine folds every order scoped adjustment into `grandTotalNetAmount` (it is by
 * construction identical to `subtotalNetAmount`), so the lines-only figure a US totals block
 * opens with has to be read back out of it. Backing out exactly the rows the block then lists
 * again is what makes the column add up: subtotal - discount + shipping + surcharge + tax equals
 * `grandTotalGrossAmount` for every document. Adjustment kinds that get no row of their own stay
 * inside the subtotal rather than vanishing from the total; they remain itemized on the
 * Adjustments tab.
 */
export function resolveSinglePriceSubtotal(record: DocumentTotalsRecord): number {
  return (
    amount(record.grandTotalNetAmount) +
    amount(record.discountTotalAmount) -
    amount(record.shippingNetAmount) -
    amount(record.surchargeTotalAmount)
  )
}

/**
 * Under `single_price_plus_tax` the block is a column that adds up: Subtotal, Discount, Shipping,
 * Tax, Total. There is no net/gross twin of any row, because the tax line is separate and a gross
 * amount beside it double counts (spec D7, "Price presentation"). Under `dual_net_gross`, and with
 * no profile at all, the EU block is returned unchanged.
 */
export function buildDocumentTotalsItems({
  record,
  kind,
  profile,
  translate,
  adjustments,
  adjustmentLabel,
}: BuildDocumentTotalsItemsParams): DocumentTotalItem[] {
  const t = translate
  const singlePrice = showsSinglePricePlusTax(profile)
  const priceLabel = (baseKey: string, fallback: string) => t(resolvePriceLabelKey(baseKey, profile), fallback)
  const taxIsEstimate = (record.taxStatus ?? null) !== 'calculated'
  const marketTaxNoteKey = taxNoteKey(profile)
  const taxNote = singlePrice && taxIsEstimate && marketTaxNoteKey ? t(marketTaxNoteKey) : undefined
  const taxRow: DocumentTotalItem = {
    key: 'taxTotalAmount',
    label: t(taxLineLabelKey(profile), t('sales.documents.detail.totals.taxTotal', 'Tax total')),
    amount: record.taxTotalAmount ?? null,
    note: taxNote,
  }

  if (singlePrice) return buildSinglePriceItems({ record, kind, t, priceLabel, taxRow })

  const items: DocumentTotalItem[] = [
    {
      key: 'subtotalNetAmount',
      label: priceLabel('sales.documents.detail.totals.subtotalNet', 'Subtotal (net)'),
      amount: record.subtotalNetAmount ?? null,
    },
    {
      key: 'subtotalGrossAmount',
      label: t('sales.documents.detail.totals.subtotalGross', 'Subtotal (gross)'),
      amount: record.subtotalGrossAmount ?? null,
    },
    {
      key: 'discountTotalAmount',
      label: t('sales.documents.detail.totals.discountTotal', 'Discounts'),
      amount: record.discountTotalAmount ?? null,
    },
    taxRow,
  ]
  if (kind === 'order') {
    items.push(
      {
        key: 'shippingNetAmount',
        label: priceLabel('sales.documents.detail.totals.shippingNet', 'Shipping (net)'),
        amount: record.shippingNetAmount ?? null,
      },
      {
        key: 'shippingGrossAmount',
        label: t('sales.documents.detail.totals.shippingGross', 'Shipping (gross)'),
        amount: record.shippingGrossAmount ?? null,
      },
      {
        key: 'surchargeTotalAmount',
        label: t('sales.documents.detail.totals.surchargeTotal', 'Surcharges'),
        amount: record.surchargeTotalAmount ?? null,
      },
    )
  }
  adjustments.forEach((adj) => {
    items.push({
      key: `adjustment-${adj.id}`,
      label: adjustmentLabel(adj),
      amount: adj.amountGross ?? adj.amountNet ?? null,
    })
  })
  items.push({
    key: 'grandTotalNetAmount',
    label: priceLabel('sales.documents.detail.totals.grandTotalNet', 'Grand total (net)'),
    amount: record.grandTotalNetAmount ?? null,
    emphasize: true,
  })
  items.push({
    key: 'grandTotalGrossAmount',
    label: t('sales.documents.detail.totals.grandTotalGross', 'Grand total (gross)'),
    amount: record.grandTotalGrossAmount ?? null,
    emphasize: true,
  })
  items.push(...buildPaymentItems(record, kind, t))
  return items
}

function buildSinglePriceItems({
  record,
  kind,
  t,
  priceLabel,
  taxRow,
}: {
  record: DocumentTotalsRecord
  kind: 'order' | 'quote'
  t: Translate
  priceLabel: (baseKey: string, fallback: string) => string
  taxRow: DocumentTotalItem
}): DocumentTotalItem[] {
  const items: DocumentTotalItem[] = [
    {
      key: 'subtotalNetAmount',
      label: priceLabel('sales.documents.detail.totals.subtotalNet', 'Subtotal'),
      amount: resolveSinglePriceSubtotal(record),
      pinned: true,
    },
  ]
  if (isPresent(record.discountTotalAmount)) {
    items.push({
      key: 'discountTotalAmount',
      label: priceLabel('sales.documents.detail.totals.discountTotal', 'Discount'),
      amount: -Math.abs(amount(record.discountTotalAmount)),
      pinned: true,
    })
  }
  if (isPresent(record.shippingNetAmount)) {
    items.push({
      key: 'shippingNetAmount',
      label: priceLabel('sales.documents.detail.totals.shippingNet', 'Shipping'),
      amount: record.shippingNetAmount ?? null,
      pinned: true,
    })
  }
  if (isPresent(record.surchargeTotalAmount)) {
    items.push({
      key: 'surchargeTotalAmount',
      label: t('sales.documents.detail.totals.surchargeTotal', 'Surcharges'),
      amount: record.surchargeTotalAmount ?? null,
      pinned: true,
    })
  }
  items.push({ ...taxRow, pinned: true })
  items.push({
    key: 'grandTotalGrossAmount',
    label: priceLabel('sales.documents.detail.totals.grandTotalNet', 'Total'),
    amount: record.grandTotalGrossAmount ?? null,
    emphasize: true,
  })
  items.push(...buildPaymentItems(record, kind, t))
  return items
}

function buildPaymentItems(
  record: DocumentTotalsRecord,
  kind: 'order' | 'quote',
  t: Translate,
): DocumentTotalItem[] {
  if (kind !== 'order') return []
  return [
    {
      key: 'paidTotalAmount',
      label: t('sales.documents.detail.totals.paidTotal', 'Paid'),
      amount: record.paidTotalAmount ?? null,
    },
    {
      key: 'refundedTotalAmount',
      label: t('sales.documents.detail.totals.refundedTotal', 'Refunded'),
      amount: record.refundedTotalAmount ?? null,
    },
    {
      key: 'outstandingAmount',
      label: t('sales.documents.detail.totals.outstandingTotal', 'Outstanding'),
      amount: record.outstandingAmount ?? null,
      emphasize: true,
    },
  ]
}
