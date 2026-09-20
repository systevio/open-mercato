import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { formatAmount } from '../shared'

describe('sales dashboard money display', () => {
  it('uses the market presentation without replacing an explicit currency', () => {
    expect(formatAmount('1234.5', 'USD', 'en-US', US_DISPLAY_TEMPLATE)).toBe('$1,234.50')
    expect(formatAmount('1234.5', 'PLN', 'en-US', US_DISPLAY_TEMPLATE)).toContain('PLN')
  })

  it('keeps an amount with no denomination currency-free', () => {
    const formatted = formatAmount('1234.5', null, 'en-US', US_DISPLAY_TEMPLATE)
    expect(formatted).toBe('1,234.5')
    expect(formatted).not.toContain('$')
  })
})
