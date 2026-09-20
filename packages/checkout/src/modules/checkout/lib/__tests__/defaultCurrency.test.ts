import { resolvePristineCurrencyDefault } from '../defaultCurrency'

describe('resolvePristineCurrencyDefault', () => {
  it('uses a supported market currency for a pristine create form', () => {
    expect(resolvePristineCurrencyDefault('usd', ['PLN', 'USD'])).toBe('USD')
  })

  it('falls back to an actually supported currency when the market currency is unavailable', () => {
    expect(resolvePristineCurrencyDefault('USD', ['PLN', 'EUR'])).toBe('PLN')
  })

  it('keeps the legacy default only when the currency dictionary is empty', () => {
    expect(resolvePristineCurrencyDefault('USD', [])).toBe('USD')
  })
})
