import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { formatWarrantyAmount } from '../lib/displayMoney'

describe('formatWarrantyAmount', () => {
  it('preserves a claim currency that differs from the active profile', () => {
    expect(formatWarrantyAmount('1234.50', 'PLN', US_DISPLAY_TEMPLATE)?.replace(/\u00a0/g, ' ')).toBe('PLN 1,234.50')
  })

  it('does not infer a historical denomination for a claim with no currency', () => {
    expect(formatWarrantyAmount('1234.50', null, US_DISPLAY_TEMPLATE)).toBe('1,234.5')
  })
})
