/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => (_key: string, fallback?: string, params?: Record<string, string | number>) => {
    const template = fallback ?? _key
    if (!params) return template
    return Object.entries(params).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), template)
  },
}))

jest.mock('@open-mercato/ui/backend/markets/MarketProfileProvider', () => ({
  useDisplayProfile: () => US_DISPLAY_TEMPLATE,
}))

import { ConfirmStep } from '../components/ConfirmStep'

const address = { countryCode: 'US', postalCode: '60601', city: 'Chicago', line1: '1 Main St' }
const contact = { phone: '+13125550100', email: 'shipping@example.com' }

describe('shipment confirmation money display', () => {
  it('uses US presentation while preserving each carrier rate currency', () => {
    render(
      <ConfirmStep
        rates={[
          { serviceCode: 'usd', serviceName: 'US rate', amount: 12.5, currencyCode: 'USD' },
          { serviceCode: 'pln', serviceName: 'Polish rate', amount: 50, currencyCode: 'PLN' },
        ]}
        ratesError={null}
        selectedRate={null}
        selectedProvider="test"
        origin={address}
        destination={address}
        packages={[{ weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1 }]}
        labelFormat="pdf"
        senderContact={contact}
        receiverContact={contact}
        targetPoint=""
        c2cSendingMethod=""
        isSubmitting={false}
        onRateSelect={jest.fn()}
        onBack={jest.fn()}
        onSubmit={jest.fn()}
      />,
    )

    expect(screen.getByText('$12.50')).toBeTruthy()
    expect(screen.getByText(/PLN/)).toBeTruthy()
  })
})
