import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { formatCheckoutMoney } from '../displayMoney'

describe('formatCheckoutMoney', () => {
  it('uses profile conventions without replacing the stored currency', () => {
    expect(formatCheckoutMoney(1234.5, 'EUR', US_DISPLAY_TEMPLATE)).toBe('€1,234.50')
  })

  it('does not infer a denomination when the stored currency is missing', () => {
    expect(formatCheckoutMoney(1234.5, null, US_DISPLAY_TEMPLATE)).toBe('1,234.5')
  })
})
