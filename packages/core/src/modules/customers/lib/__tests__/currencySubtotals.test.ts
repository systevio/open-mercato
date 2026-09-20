import {
  groupCurrencySubtotals,
  normalizeCurrencyCode,
  parseMoneyAmount,
} from '../currencySubtotals'

describe('customer currency subtotals', () => {
  it('keeps explicit currencies separate and exposes missing denominations', () => {
    expect(groupCurrencySubtotals([
      { valueAmount: '1200.50', valueCurrency: 'pln' },
      { valueAmount: 300, valueCurrency: 'PLN' },
      { valueAmount: '75', valueCurrency: 'USD' },
      { valueAmount: '25', valueCurrency: null },
    ])).toEqual([
      { currencyCode: 'PLN', amount: 1500.5, count: 2, invalidAmountCount: 0 },
      { currencyCode: 'USD', amount: 75, count: 1, invalidAmountCount: 0 },
      { currencyCode: null, amount: 25, count: 1, invalidAmountCount: 0 },
    ])
  })

  it('counts invalid amounts without hiding the denomination', () => {
    expect(groupCurrencySubtotals([
      { valueAmount: 'not-a-number', valueCurrency: 'EUR' },
      { valueAmount: null, valueCurrency: 'EUR' },
    ])).toEqual([
      { currencyCode: 'EUR', amount: 0, count: 2, invalidAmountCount: 2 },
    ])
  })

  it('accepts finite numeric values and rejects malformed values and codes', () => {
    expect(parseMoneyAmount(' 12.5 ')).toBe(12.5)
    expect(parseMoneyAmount(Number.POSITIVE_INFINITY)).toBeNull()
    expect(parseMoneyAmount('')).toBeNull()
    expect(normalizeCurrencyCode(' usd ')).toBe('USD')
    expect(normalizeCurrencyCode('US')).toBeNull()
  })
})
