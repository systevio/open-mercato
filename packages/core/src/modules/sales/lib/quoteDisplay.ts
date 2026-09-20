import { formatDate } from '@open-mercato/shared/lib/display/datetime'
import { formatMoney } from '@open-mercato/shared/lib/display/money'
import {
  resolvePriceLabelKey,
  showsSinglePricePlusTax,
  taxLineLabelKey,
  taxNoteKey,
} from '@open-mercato/shared/lib/display/price'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'
import {
  extractTaxInfoLines,
  resolveLineTaxAmount,
  resolveLineTotalIncludingTax,
} from './lineTaxPresentation'

type Translate = (key: string, fallback?: string, params?: Record<string, string | number>) => string

export type QuoteDisplayTotals = {
  currencyCode: string
  subtotalNetAmount?: string | null
  subtotalGrossAmount?: string | null
  discountTotalAmount?: string | null
  taxTotalAmount?: string | null
  grandTotalNetAmount?: string | null
  grandTotalGrossAmount?: string | null
  validUntil?: Date | string | null
  taxStatus?: string | null
  /** The quote's persisted tax result, source of the per line tax figures. */
  taxInfo?: unknown
}

export type QuoteDisplayLineInput = {
  id?: string | null
  currencyCode?: string | null
  unitPriceNet?: string | null
  unitPriceGross?: string | null
  taxAmount?: string | null
  totalNetAmount?: string | null
  totalGrossAmount?: string | null
}

export type QuoteDisplayLine = {
  unitPrice: string | null
  total: string | null
  /**
   * The line's own tax and its tax inclusive total, formatted, or `null` when the quote's tax
   * result says nothing about this line. Only rendered under `single_price_plus_tax`.
   */
  tax: string | null
  totalIncludingTax: string | null
}

/**
 * Everything a quote surface needs to render already formatted, built once on the server.
 *
 * The public quote page and the quote emails both reach customers who are not signed in, so they
 * cannot resolve the merchant's market themselves - the provider only knows the market of whoever
 * is logged in, and for these two surfaces that is nobody. Formatting on the server, against the
 * quote's OWN organization, is what makes a US merchant's customer see `$48,250.00` and
 * `10/18/2026` in an email client that has no idea which market the quote came from.
 */
export type QuoteDisplayViewModel = {
  singlePricePlusTax: boolean
  validUntil: string | null
  /** The market's name for the first totals row, already translated. */
  subtotalLabel: string
  subtotal: string | null
  discountLabel: string
  /** `null` under `single_price_plus_tax` when there is no discount, so the row is dropped. */
  discountTotal: string | null
  taxTotal: string | null
  /** The market's name for the last totals row, already translated. */
  totalLabel: string
  grandTotal: string | null
  /** The market's name for the tax line ("Sales tax", "VAT"), already translated. */
  taxLabel: string
  /** The market's note under an estimated tax line, already translated, or `null`. */
  taxNote: string | null
  lines: QuoteDisplayLine[]
}

function money(
  amount: string | number | null | undefined,
  currencyCode: string | null | undefined,
  profile: DisplayProfile | null,
  locale: string | null | undefined,
): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  return formatMoney(amount, currencyCode, profile, { locale })
}

function toNumber(value: string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Build the preformatted view model for one quote.
 *
 * Under `single_price_plus_tax` the single price is the NET amount, whatever a line's price kind
 * says, because the tax line is rendered separately and a gross amount beside it double counts
 * (spec, Price presentation). The totals then form a column that adds up - Subtotal, Discount, tax,
 * Total - so the subtotal backs the discount out of the engine's net grand total and the Total is
 * the tax inclusive one. A quote persists no shipping or surcharge column of its own, so an
 * adjustment of either kind stays inside the subtotal. Under `dual_net_gross` the gross amount is
 * the headline and the grand total is the net one, exactly as today.
 */
export function buildQuoteDisplayViewModel(
  totals: QuoteDisplayTotals,
  lines: QuoteDisplayLineInput[],
  profile: DisplayProfile | null,
  translate: Translate,
  locale?: string | null,
): QuoteDisplayViewModel {
  const singlePricePlusTax = showsSinglePricePlusTax(profile)
  const currency = totals.currencyCode
  const headline = (net: string | null | undefined, gross: string | null | undefined) =>
    (singlePricePlusTax ? net : (gross ?? net))
  const label = (baseKey: string, fallback: string) =>
    translate(resolvePriceLabelKey(baseKey, profile), fallback)

  const marketTaxNoteKey = taxNoteKey(profile)
  const taxIsEstimate = (totals.taxStatus ?? null) !== 'calculated'
  const taxInfoLines = extractTaxInfoLines(totals.taxInfo)
  const discountAmount = toNumber(totals.discountTotalAmount)
  const hasNetTotal = !(
    totals.grandTotalNetAmount === null ||
    totals.grandTotalNetAmount === undefined ||
    totals.grandTotalNetAmount === ''
  )
  const subtotalAmount = singlePricePlusTax
    ? (hasNetTotal ? toNumber(totals.grandTotalNetAmount) + discountAmount : null)
    : headline(totals.subtotalNetAmount, totals.subtotalGrossAmount)
  const grandTotalAmount = singlePricePlusTax
    ? (totals.grandTotalGrossAmount ?? totals.grandTotalNetAmount)
    : headline(totals.grandTotalNetAmount, totals.grandTotalGrossAmount)
  const discountDisplayAmount = singlePricePlusTax
    ? (discountAmount === 0 ? null : -Math.abs(discountAmount))
    : (totals.discountTotalAmount ?? null)

  return {
    singlePricePlusTax,
    validUntil: formatDate(totals.validUntil ?? null, profile, { locale }),
    subtotalLabel: label('sales.quotes.public.subtotalGross', 'Subtotal'),
    subtotal: money(subtotalAmount, currency, profile, locale),
    discountLabel: translate('sales.quotes.public.discount', 'Discount'),
    discountTotal: money(discountDisplayAmount, currency, profile, locale),
    taxTotal: money(totals.taxTotalAmount, currency, profile, locale),
    totalLabel: translate('sales.quotes.public.total', 'Total'),
    grandTotal: money(grandTotalAmount, currency, profile, locale),
    taxLabel: translate(taxLineLabelKey(profile), translate('sales.quotes.public.tax', 'Tax')),
    taxNote: singlePricePlusTax && taxIsEstimate && marketTaxNoteKey ? translate(marketTaxNoteKey) : null,
    lines: lines.map((line) => {
      const lineCurrency = line.currencyCode ?? currency
      const lineTax = singlePricePlusTax
        ? resolveLineTaxAmount(line.id ?? null, line.taxAmount, taxInfoLines)
        : null
      return {
        unitPrice: money(headline(line.unitPriceNet, line.unitPriceGross), lineCurrency, profile, locale),
        total: money(headline(line.totalNetAmount, line.totalGrossAmount), lineCurrency, profile, locale),
        tax: money(lineTax, lineCurrency, profile, locale),
        totalIncludingTax: money(
          resolveLineTotalIncludingTax(line.totalNetAmount, lineTax),
          lineCurrency,
          profile,
          locale,
        ),
      }
    }),
  }
}
