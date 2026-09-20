import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { formatVariantPrice } from '../messageObjectPreviews'

describe('catalog message preview money display', () => {
  it('uses profile conventions while preserving stored currency', () => {
    expect(formatVariantPrice('1234.5', 'USD', US_DISPLAY_TEMPLATE)).toBe('$1,234.50')
    expect(formatVariantPrice('1234.5', 'PLN', US_DISPLAY_TEMPLATE)).toContain('PLN')
  })

  it('does not label a missing denomination as the profile currency', () => {
    const formatted = formatVariantPrice('1234.5', null, US_DISPLAY_TEMPLATE)
    expect(formatted).toBe('1,234.5')
    expect(formatted).not.toContain('$')
  })

  it('preserves the legacy formatter when no profile is available', () => {
    expect(formatVariantPrice('1234.5', 'USD')).toBe(
      new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1234.5),
    )
  })
})
