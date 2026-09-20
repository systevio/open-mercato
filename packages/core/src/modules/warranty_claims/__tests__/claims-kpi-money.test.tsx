/** @jest-environment jsdom */
import * as React from 'react'
import { renderWithProviders } from '@open-mercato/shared/lib/testing/renderWithProviders'
import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import enDict from '../i18n/en.json'
import { ClaimsKpiStrip } from '../backend/components/ClaimsKpiStrip'

jest.mock('@open-mercato/ui/backend/markets/MarketProfileProvider', () => ({
  useDisplayProfile: () => US_DISPLAY_TEMPLATE,
}))

describe('ClaimsKpiStrip money display', () => {
  it('renders each recovered currency separately and labels unknown denominations', () => {
    const view = renderWithProviders(
      <ClaimsKpiStrip
        stats={{
          openByStatus: { submitted: 1 },
          overdue: 0,
          assignedToMe: 0,
          resolvedLast30d: 1,
          avgResolutionDays: 2,
          approvalRatePct: 100,
          recoveredLast30dByCurrency: [
            { currencyCode: 'USD', total: 125 },
            { currencyCode: 'PLN', total: 80 },
            { currencyCode: null, total: 50 },
          ],
        }}
        isLoading={false}
        hasError={false}
        onOverdueClick={() => undefined}
        onOpenClaimsClick={() => undefined}
      />,
      { dict: enDict },
    )

    expect(view.getByText('$125.00')).toBeTruthy()
    expect(view.getByText('PLN 80.00')).toBeTruthy()
    expect(view.getByText('50 currency unknown')).toBeTruthy()
  })
})
