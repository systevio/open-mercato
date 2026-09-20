/**
 * The per line tax figures a `single_price_plus_tax` document shows next to each row.
 *
 * Presentation only: nothing here recalculates tax. The number comes from the document's persisted
 * tax result (`tax_info.lines[].taxAmount`, written by the selected provider or the built in
 * default) and the line's own stored `tax_amount` is the fallback for a document whose tax result
 * predates the line or never itemized it.
 */

export type TaxInfoLineTax = {
  lineId?: string | null
  taxAmount?: number | string | null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * The tax booked against one line, or `null` when the document has none to show for it.
 *
 * A `tax_info` entry wins and is honoured even at zero — a provider that calculated `0.00` for a
 * non taxable line said something, and a dash would hide it. The line's own column cannot say the
 * same: `sales_*_lines.tax_amount` is `NOT NULL DEFAULT '0'`, so a stored `0` is indistinguishable
 * from "never calculated" and counts as absent. That is what makes a `fallback` or `exempt`
 * document with an empty `tax_info.lines` show a dash per row and only a document level tax total,
 * rather than a column of confident zeros.
 */
export function resolveLineTaxAmount(
  lineId: string | null | undefined,
  ownTaxAmount: number | string | null | undefined,
  taxInfoLines: TaxInfoLineTax[] | null | undefined,
): number | null {
  if (lineId && Array.isArray(taxInfoLines)) {
    const entry = taxInfoLines.find((line) => line && line.lineId === lineId)
    if (entry) {
      const fromTaxInfo = toFiniteNumber(entry.taxAmount)
      if (fromTaxInfo !== null) return fromTaxInfo
    }
  }
  const own = toFiniteNumber(ownTaxAmount)
  if (own !== null && own !== 0) return own
  return null
}

/** The line total plus its tax, or `null` when the line has no tax figure to add. */
export function resolveLineTotalIncludingTax(
  lineTotalNet: number | string | null | undefined,
  taxAmount: number | null,
): number | null {
  if (taxAmount === null) return null
  const net = toFiniteNumber(lineTotalNet)
  if (net === null) return null
  return net + taxAmount
}

/** Reads `tax_info.lines` off a persisted tax document without trusting its shape. */
export function extractTaxInfoLines(taxInfo: unknown): TaxInfoLineTax[] {
  if (!taxInfo || typeof taxInfo !== 'object') return []
  const lines = (taxInfo as { lines?: unknown }).lines
  if (!Array.isArray(lines)) return []
  return lines.flatMap((line) => {
    if (!line || typeof line !== 'object') return []
    const record = line as Record<string, unknown>
    const lineId = typeof record.lineId === 'string' ? record.lineId : null
    if (!lineId) return []
    return [{ lineId, taxAmount: (record.taxAmount ?? null) as number | string | null }]
  })
}
