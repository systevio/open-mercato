import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { formatPriceValue } from '../offerTableUtils'

describe('channel offer money display', () => {
  it('formats the selected price amount with the explicit denomination', () => {
    expect(formatPriceValue({
      currencyCode: 'USD',
      unitPriceNet: '1234.5',
      displayMode: 'excluding-tax',
    }, US_DISPLAY_TEMPLATE)).toBe('$1,234.50')

    expect(formatPriceValue({
      currencyCode: 'PLN',
      unitPriceGross: '1234.5',
      displayMode: 'including-tax',
    }, US_DISPLAY_TEMPLATE)).toContain('PLN')
  })

  it('does not infer the profile currency when a price has no denomination', () => {
    const formatted = formatPriceValue({ unitPriceNet: '1234.5' }, US_DISPLAY_TEMPLATE)
    expect(formatted).toBe('1,234.5')
    expect(formatted).not.toContain('$')
  })

  it('preserves the legacy formatter when no profile is available', () => {
    expect(formatPriceValue({
      currencyCode: 'USD',
      unitPriceNet: '1234.5',
      displayMode: 'excluding-tax',
    })).toBe('USD 1234.5')
  })
})
