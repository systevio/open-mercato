import {
  extractTaxInfoLines,
  resolveLineTaxAmount,
  resolveLineTotalIncludingTax,
} from '../lineTaxPresentation'

const taxInfoLines = [{ lineId: 'line-1', taxAmount: 76.13 }]

describe('resolveLineTaxAmount', () => {
  it('prefers the document tax result over the line own column', () => {
    expect(resolveLineTaxAmount('line-1', 5, taxInfoLines)).toBe(76.13)
  })

  it('honours a zero the tax result itemized', () => {
    expect(resolveLineTaxAmount('line-1', 5, [{ lineId: 'line-1', taxAmount: '0' }])).toBe(0)
  })

  it('falls back to the line own tax amount when the result does not name the line', () => {
    expect(resolveLineTaxAmount('line-2', '12.50', taxInfoLines)).toBe(12.5)
    expect(resolveLineTaxAmount('line-2', '12.50', null)).toBe(12.5)
  })

  it('treats the line own zero as absent, because the column is NOT NULL DEFAULT 0', () => {
    expect(resolveLineTaxAmount('line-2', 0, taxInfoLines)).toBeNull()
    expect(resolveLineTaxAmount('line-2', '0', [])).toBeNull()
    expect(resolveLineTaxAmount(null, null, null)).toBeNull()
  })
})

describe('resolveLineTotalIncludingTax', () => {
  it('adds the tax to the line total', () => {
    expect(resolveLineTotalIncludingTax('1000', 76.13)).toBeCloseTo(1076.13, 2)
  })

  it('stays unset when the line has no tax figure', () => {
    expect(resolveLineTotalIncludingTax('1000', null)).toBeNull()
    expect(resolveLineTotalIncludingTax(null, 5)).toBeNull()
  })
})

describe('extractTaxInfoLines', () => {
  it('reads the itemized lines off a persisted tax document', () => {
    expect(extractTaxInfoLines({ version: 1, lines: taxInfoLines })).toEqual(taxInfoLines)
  })

  it('returns nothing for a tax document that itemizes nothing', () => {
    expect(extractTaxInfoLines(null)).toEqual([])
    expect(extractTaxInfoLines({ version: 1, lines: [] })).toEqual([])
    expect(extractTaxInfoLines({ version: 1, lines: [{ taxAmount: 5 }, 'nonsense'] })).toEqual([])
  })
})
