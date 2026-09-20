import { EU_DISPLAY_TEMPLATE, US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { buildDocumentTotalsItems, type DocumentTotalsRecord } from '../documentTotalsItems'

// Echoes the key so an assertion names the label key the market resolved to, not the English that
// happens to be inlined at the call site.
const translate = (key: string) => key

/**
 * An order whose lines come to 1,000.00 before tax, with a 100.00 discount, 50.00 of shipping and
 * 76.13 of sales tax on top. The engine folds the discount and the shipping into its net grand
 * total, so `grandTotalNetAmount` is 950.00 and the gross one is 1,026.13.
 */
const order: DocumentTotalsRecord = {
  subtotalNetAmount: 950,
  subtotalGrossAmount: 1026.13,
  discountTotalAmount: 100,
  taxTotalAmount: 76.13,
  shippingNetAmount: 50,
  shippingGrossAmount: 54,
  surchargeTotalAmount: 0,
  grandTotalNetAmount: 950,
  grandTotalGrossAmount: 1026.13,
  paidTotalAmount: 0,
  refundedTotalAmount: 0,
  outstandingAmount: 1026.13,
  taxStatus: 'calculated',
}

function build(record: DocumentTotalsRecord, profile: typeof US_DISPLAY_TEMPLATE | null, kind: 'order' | 'quote' = 'order') {
  return buildDocumentTotalsItems({
    record,
    kind,
    profile,
    translate,
    adjustments: [],
    adjustmentLabel: () => 'adjustment',
  })
}

function byKey(items: ReturnType<typeof build>, key: string) {
  return items.find((item) => item.key === key)
}

describe('document totals under single_price_plus_tax', () => {
  it('renders exactly subtotal, discount, shipping, tax and total for the price rows', () => {
    const items = build(order, US_DISPLAY_TEMPLATE)
    const priceRows = items.filter(
      (item) => !['paidTotalAmount', 'refundedTotalAmount', 'outstandingAmount'].includes(item.key),
    )

    expect(priceRows.map((item) => item.key)).toEqual([
      'subtotalNetAmount',
      'discountTotalAmount',
      'shippingNetAmount',
      'taxTotalAmount',
      'grandTotalGrossAmount',
    ])
  })

  it('opens with the lines before tax and closes with the tax inclusive total', () => {
    const items = build(order, US_DISPLAY_TEMPLATE)

    expect(byKey(items, 'subtotalNetAmount')?.amount).toBeCloseTo(1000, 2)
    expect(byKey(items, 'grandTotalGrossAmount')?.amount).toBeCloseTo(1026.13, 2)
  })

  it('adds up: subtotal + discount + shipping + tax is the total', () => {
    const items = build(order, US_DISPLAY_TEMPLATE)
    const sum = ['subtotalNetAmount', 'discountTotalAmount', 'shippingNetAmount', 'taxTotalAmount']
      .map((key) => Number(byKey(items, key)?.amount ?? 0))
      .reduce((acc, value) => acc + value, 0)

    expect(sum).toBeCloseTo(Number(byKey(items, 'grandTotalGrossAmount')?.amount), 2)
  })

  it('shows the discount as a negative amount', () => {
    expect(byKey(build(order, US_DISPLAY_TEMPLATE), 'discountTotalAmount')?.amount).toBeCloseTo(-100, 2)
  })

  it('drops the discount and the shipping rows when there are none', () => {
    const items = build(
      { ...order, discountTotalAmount: 0, shippingNetAmount: 0, grandTotalNetAmount: 1000, grandTotalGrossAmount: 1076.13 },
      US_DISPLAY_TEMPLATE,
    )

    expect(byKey(items, 'discountTotalAmount')).toBeUndefined()
    expect(byKey(items, 'shippingNetAmount')).toBeUndefined()
    expect(byKey(items, 'subtotalNetAmount')?.amount).toBeCloseTo(1000, 2)
  })

  it('never labels a row net or gross, and keeps the market tax label', () => {
    const items = build(order, US_DISPLAY_TEMPLATE)

    expect(items.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'sales.documents.detail.totals.subtotal',
        'sales.documents.usPresentation.totals.discount',
        'sales.documents.detail.totals.shipping',
        'markets.tax.label.salesTax',
        'sales.documents.detail.totals.grandTotal',
      ]),
    )
    expect(items.some((item) => /Net|Gross/.test(item.label))).toBe(false)
  })

  it('keeps every term of the sum visible while the block is collapsed', () => {
    const items = build(order, US_DISPLAY_TEMPLATE)
    const pinned = items.filter((item) => item.pinned).map((item) => item.key)

    expect(pinned).toEqual([
      'subtotalNetAmount',
      'discountTotalAmount',
      'shippingNetAmount',
      'taxTotalAmount',
    ])
  })

  it('carries the market estimate note onto an uncalculated tax line', () => {
    const items = build({ ...order, taxStatus: 'fallback' }, US_DISPLAY_TEMPLATE)

    expect(byKey(items, 'taxTotalAmount')?.note).toBe('markets.tax.note.calculatedAtOrder')
  })

  it('keeps the payment rows an order already had', () => {
    const items = build({ ...order, paidTotalAmount: 500 }, US_DISPLAY_TEMPLATE)

    expect(byKey(items, 'paidTotalAmount')?.amount).toBe(500)
    expect(byKey(items, 'outstandingAmount')?.emphasize).toBe(true)
  })

  it('leaves a quote without the order-only rows', () => {
    const items = build(order, US_DISPLAY_TEMPLATE, 'quote')

    expect(byKey(items, 'paidTotalAmount')).toBeUndefined()
    expect(byKey(items, 'grandTotalGrossAmount')?.emphasize).toBe(true)
  })
})

describe('document totals under dual_net_gross', () => {
  it('keeps the EU net/gross block exactly as it was', () => {
    const items = build(order, EU_DISPLAY_TEMPLATE)

    expect(items.map((item) => item.key)).toEqual([
      'subtotalNetAmount',
      'subtotalGrossAmount',
      'discountTotalAmount',
      'taxTotalAmount',
      'shippingNetAmount',
      'shippingGrossAmount',
      'surchargeTotalAmount',
      'grandTotalNetAmount',
      'grandTotalGrossAmount',
      'paidTotalAmount',
      'refundedTotalAmount',
      'outstandingAmount',
    ])
    expect(byKey(items, 'subtotalNetAmount')?.amount).toBe(950)
    expect(byKey(items, 'discountTotalAmount')?.amount).toBe(100)
    expect(items.some((item) => item.pinned)).toBe(false)
  })

  it('produces the same block with no market profile at all', () => {
    expect(build(order, null).map((item) => item.key)).toEqual(build(order, EU_DISPLAY_TEMPLATE).map((item) => item.key))
  })

  it('itemizes the document adjustments', () => {
    const items = buildDocumentTotalsItems({
      record: order,
      kind: 'order',
      profile: EU_DISPLAY_TEMPLATE,
      translate,
      adjustments: [{ id: 'adj-1', amountNet: 10, amountGross: 12 }],
      adjustmentLabel: () => 'Handling',
    })

    expect(byKey(items, 'adjustment-adj-1')).toEqual({ key: 'adjustment-adj-1', label: 'Handling', amount: 12 })
  })
})
