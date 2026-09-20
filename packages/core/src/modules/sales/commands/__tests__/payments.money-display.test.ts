import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { formatPaymentNotificationAmount } from '../payments'

describe('payment notification money display', () => {
  it('uses profile conventions while preserving explicit currency', () => {
    expect(formatPaymentNotificationAmount('1234.5', 'USD', US_DISPLAY_TEMPLATE)).toBe('$1,234.50')
    expect(formatPaymentNotificationAmount('1234.5', 'PLN', US_DISPLAY_TEMPLATE)).toContain('PLN')
  })

  it('preserves the legacy no-profile notification text', () => {
    expect(formatPaymentNotificationAmount('1234.5', 'EUR', null)).toBe('EUR 1234.5')
  })
})
