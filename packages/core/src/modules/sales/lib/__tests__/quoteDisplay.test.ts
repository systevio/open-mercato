import { EU_DISPLAY_TEMPLATE, US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { buildQuoteDisplayViewModel } from '../quoteDisplay'

// Echoes the key rather than the fallback, so an assertion names the key the market chose rather
// than whatever English happened to be inlined at the call site.
const translate = (key: string) => key

// One line of 48,250.00 net carrying 11,097.50 of tax. Net + tax = gross, so a US block built from
// this fixture is a column that adds up.
const totals = {
  currencyCode: 'USD',
  subtotalNetAmount: '48250',
  subtotalGrossAmount: '59347.50',
  discountTotalAmount: '0',
  taxTotalAmount: '11097.50',
  grandTotalNetAmount: '48250',
  grandTotalGrossAmount: '59347.50',
  validUntil: '2026-10-18',
  taxStatus: null,
}

const lines = [
  {
    id: 'line-1',
    currencyCode: 'USD',
    unitPriceNet: '1930',
    unitPriceGross: '2373.90',
    taxAmount: '11097.50',
    totalNetAmount: '48250',
    totalGrossAmount: '59347.50',
  },
]

const taxInfo = {
  version: 1,
  totals: { taxTotal: 11097.5, taxableTotal: 48250, exemptTotal: 0 },
  lines: [{ lineId: 'line-1', taxAmount: 11097.5 }],
}

describe('buildQuoteDisplayViewModel', () => {
  it('shows the net amount as the single price and the tax inclusive amount as the total', () => {
    const view = buildQuoteDisplayViewModel(totals, lines, US_DISPLAY_TEMPLATE, translate, 'en')

    expect(view.singlePricePlusTax).toBe(true)
    expect(view.subtotal).toBe('$48,250.00')
    expect(view.taxTotal).toBe('$11,097.50')
    expect(view.grandTotal).toBe('$59,347.50')
    expect(view.validUntil).toBe('10/18/2026')
  })

  it('neutralizes the subtotal and total labels rather than editing the EU strings', () => {
    const view = buildQuoteDisplayViewModel(totals, lines, US_DISPLAY_TEMPLATE, translate, 'en')

    expect(view.subtotalLabel).toBe('sales.quotes.public.subtotal')
    expect(view.totalLabel).toBe('sales.quotes.public.total')
  })

  it('takes the per line tax from the document tax result', () => {
    const view = buildQuoteDisplayViewModel(
      { ...totals, taxInfo },
      lines,
      US_DISPLAY_TEMPLATE,
      translate,
      'en',
    )

    expect(view.lines[0]).toEqual({
      unitPrice: '$1,930.00',
      total: '$48,250.00',
      tax: '$11,097.50',
      totalIncludingTax: '$59,347.50',
    })
  })

  it('falls back to the line own tax amount when the tax result does not itemize the line', () => {
    const view = buildQuoteDisplayViewModel(
      { ...totals, taxInfo: { version: 1, lines: [{ lineId: 'other-line', taxAmount: 5 }] } },
      lines,
      US_DISPLAY_TEMPLATE,
      translate,
      'en',
    )

    expect(view.lines[0].tax).toBe('$11,097.50')
    expect(view.lines[0].totalIncludingTax).toBe('$59,347.50')
  })

  it('leaves the per line tax unset when the document carries none', () => {
    const view = buildQuoteDisplayViewModel(
      { ...totals, taxStatus: 'fallback', taxTotalAmount: '0', grandTotalGrossAmount: '48250' },
      [{ ...lines[0], taxAmount: '0', totalGrossAmount: '48250' }],
      US_DISPLAY_TEMPLATE,
      translate,
      'en',
    )

    expect(view.lines[0].tax).toBeNull()
    expect(view.lines[0].totalIncludingTax).toBeNull()
    expect(view.taxTotal).toBe('$0.00')
  })

  it('renders a discount as a negative row and drops it when there is none', () => {
    const withDiscount = buildQuoteDisplayViewModel(
      { ...totals, discountTotalAmount: '1250' },
      lines,
      US_DISPLAY_TEMPLATE,
      translate,
      'en',
    )

    expect(withDiscount.discountTotal).toBe('-$1,250.00')
    // Subtotal backs the discount out of the engine's net grand total, so
    // subtotal - discount + tax is the total again.
    expect(withDiscount.subtotal).toBe('$49,500.00')
    expect(buildQuoteDisplayViewModel(totals, lines, US_DISPLAY_TEMPLATE, translate, 'en').discountTotal).toBeNull()
  })

  it('names the tax line and its estimate note from the market', () => {
    const view = buildQuoteDisplayViewModel(totals, lines, US_DISPLAY_TEMPLATE, translate, 'en')

    expect(view.taxLabel).toBe('markets.tax.label.salesTax')
    expect(view.taxNote).toBe('markets.tax.note.calculatedAtOrder')
  })

  it('drops the estimate note once the tax is a firm calculation', () => {
    const view = buildQuoteDisplayViewModel(
      { ...totals, taxStatus: 'calculated' },
      lines,
      US_DISPLAY_TEMPLATE,
      translate,
      'en',
    )

    expect(view.taxNote).toBeNull()
  })

  it('keeps the gross amount as the headline under a dual net/gross market', () => {
    const view = buildQuoteDisplayViewModel(
      { ...totals, currencyCode: 'EUR' },
      [{ ...lines[0], currencyCode: 'EUR' }],
      EU_DISPLAY_TEMPLATE,
      translate,
      'en',
    )

    expect(view.singlePricePlusTax).toBe(false)
    expect(view.subtotal).toBe('€59 347,50')
    expect(view.grandTotal).toBe('€59 347,50')
    expect(view.subtotalLabel).toBe('sales.quotes.public.subtotalGross')
    expect(view.discountTotal).toBe('€0,00')
    expect(view.lines[0].tax).toBeNull()
    expect(view.lines[0].totalIncludingTax).toBeNull()
    expect(view.taxLabel).toBe('markets.tax.label.vat')
    expect(view.taxNote).toBeNull()
    expect(view.validUntil).toBe('18.10.2026')
  })

  it('falls back to the gross headline and the ambient locale with no market at all', () => {
    const view = buildQuoteDisplayViewModel(totals, lines, null, translate, 'en')

    expect(view.singlePricePlusTax).toBe(false)
    expect(view.subtotal).toBe('$59,347.50')
    expect(view.grandTotal).toBe('$59,347.50')
    expect(view.taxNote).toBeNull()
  })

  it('returns null for an amount the quote does not carry', () => {
    const view = buildQuoteDisplayViewModel(
      { currencyCode: 'USD', validUntil: null },
      [],
      US_DISPLAY_TEMPLATE,
      translate,
      'en',
    )

    expect(view.subtotal).toBeNull()
    expect(view.grandTotal).toBeNull()
    expect(view.validUntil).toBeNull()
    expect(view.lines).toEqual([])
  })
})
