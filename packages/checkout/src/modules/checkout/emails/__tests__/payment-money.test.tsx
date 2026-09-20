import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PaymentStartEmail } from '../PaymentStartEmail'
import { PaymentSuccessEmail } from '../PaymentSuccessEmail'

const startCopy = {
  title: 'Payment started',
  preview: 'Preview',
  greeting: 'Hello',
  message: 'Complete payment',
  hint: 'Secure payment',
}

const successCopy = {
  title: 'Payment complete',
  preview: 'Preview',
  greeting: 'Hello',
  receipt: 'Receipt attached',
  hint: 'Thank you',
  transactionLabel: 'Transaction',
}

describe('checkout payment email money compatibility', () => {
  it('preserves legacy amount and currency rendering for direct callers', () => {
    const start = renderToStaticMarkup(React.createElement(PaymentStartEmail, {
      firstName: 'Ada',
      amount: '33.00',
      currencyCode: 'PLN',
      linkTitle: 'Order',
      copy: startCopy,
    }))
    const success = renderToStaticMarkup(React.createElement(PaymentSuccessEmail, {
      firstName: 'Ada',
      amount: '33.00',
      currencyCode: 'PLN',
      linkTitle: 'Order',
      transactionId: 'txn-1',
      copy: successCopy,
    }))

    expect(start).toContain('33.00 PLN')
    expect(success).toContain('33.00 PLN')
  })

  it('uses an explicitly profile-formatted amount when supplied', () => {
    const html = renderToStaticMarkup(React.createElement(PaymentStartEmail, {
      firstName: 'Ada',
      amount: '33.00',
      currencyCode: 'USD',
      formattedAmount: '$33.00',
      linkTitle: 'Order',
      copy: startCopy,
    }))

    expect(html).toContain('$33.00')
    expect(html).not.toContain('33.00 USD')
  })
})
