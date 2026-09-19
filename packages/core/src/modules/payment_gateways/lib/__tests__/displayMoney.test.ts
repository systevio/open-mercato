import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { formatGatewayTransactionAmount } from '../displayMoney'

describe('formatGatewayTransactionAmount', () => {
  it('formats with the profile while preserving the transaction currency', () => {
    expect(formatGatewayTransactionAmount('1234.5', 'PLN', US_DISPLAY_TEMPLATE)?.replace(/\u00a0/g, ' ')).toBe('PLN 1,234.50')
  })

  it('keeps malformed provider amounts visibly denominated', () => {
    expect(formatGatewayTransactionAmount('pending', 'EUR', US_DISPLAY_TEMPLATE)).toBe('pending EUR')
  })

  it('preserves the legacy formatter when no profile is available', () => {
    expect(formatGatewayTransactionAmount('1234.5', 'USD')).toBe(
      new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1234.5),
    )
  })
})
