/**
 * @jest-environment jsdom
 */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { createTranslator } from '@open-mercato/shared/lib/i18n/translate'
import { EU_DISPLAY_TEMPLATE, US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'
import { DocumentTotals } from '../DocumentTotals'
import { buildDocumentTotalsItems, type DocumentTotalsRecord } from '../documentTotalsItems'

const mockTranslate = createTranslator({})

let activeProfile: DisplayProfile | null = null

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => mockTranslate,
  useLocale: () => 'en-US',
  useOptionalLocale: () => 'en-US',
}))

jest.mock('@open-mercato/ui/backend/markets/MarketProfileProvider', () => ({
  useDisplayProfile: () => activeProfile,
}))

const order: DocumentTotalsRecord = {
  subtotalNetAmount: 950,
  subtotalGrossAmount: 1026.13,
  discountTotalAmount: 100,
  taxTotalAmount: 76.13,
  shippingNetAmount: 50,
  shippingGrossAmount: 54,
  surchargeTotalAmount: 0,
  grandTotalNetAmount: 950,
  grandTotalGrossAmount: 1026.13,
  paidTotalAmount: 0,
  refundedTotalAmount: 0,
  outstandingAmount: 1026.13,
  taxStatus: 'calculated',
}

function renderTotals(profile: DisplayProfile | null, kind: 'order' | 'quote' = 'quote') {
  activeProfile = profile
  const items = buildDocumentTotalsItems({
    record: order,
    kind,
    profile,
    translate: mockTranslate,
    adjustments: [],
    adjustmentLabel: () => 'Handling',
  })
  render(<DocumentTotals currency="USD" items={items} />)
}

function rowLabels(): string[] {
  return Array.from(document.querySelectorAll('tr')).map((row) => row.querySelectorAll('td')[0]?.textContent ?? '')
}

describe('DocumentTotals under single_price_plus_tax', () => {
  it('shows every term of the sum without expanding the block', () => {
    renderTotals(US_DISPLAY_TEMPLATE)

    expect(rowLabels()).toEqual(['Subtotal', 'Discount', 'Shipping', 'Tax total', 'Total'])
    expect(screen.queryByText('sales.documents.detail.totals.showDetails')).toBeNull()
  })

  it('prints the tax inclusive total and no gross or net wording', () => {
    renderTotals(US_DISPLAY_TEMPLATE)

    expect(screen.getByText('$1,026.13')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/net|gross/i)
  })

  it('keeps the pinned price rows visible on an order that also carries payment rows', () => {
    renderTotals(US_DISPLAY_TEMPLATE, 'order')

    expect(rowLabels()).toEqual(
      expect.arrayContaining(['Subtotal', 'Discount', 'Shipping', 'Tax total', 'Total', 'Outstanding']),
    )
  })
})

describe('DocumentTotals under dual_net_gross', () => {
  it('collapses to the emphasized rows exactly as it did before', () => {
    renderTotals(EU_DISPLAY_TEMPLATE)

    expect(rowLabels()).toEqual(['Grand total (net)', 'Grand total (gross)'])
    expect(screen.getByText('sales.documents.detail.totals.showDetails')).toBeTruthy()
  })

  it('behaves the same with no market profile at all', () => {
    renderTotals(null)

    expect(rowLabels()).toEqual(['Grand total (net)', 'Grand total (gross)'])
  })
})
