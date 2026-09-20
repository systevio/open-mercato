/**
 * @jest-environment jsdom
 */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { createTranslator } from '@open-mercato/shared/lib/i18n/translate'
import { EU_DISPLAY_TEMPLATE, US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'
import { SalesDocumentItemsSection } from '../ItemsSection'

const mockApiCall = jest.fn()
const mockTranslate = createTranslator({})

// The money cells render Intl-formatted amounts, so the locale is pinned explicitly instead of
// inheriting the runner's default (#5105).
const TEST_LOCALE = 'en-US'

let activeProfile: DisplayProfile | null = null

jest.mock('@open-mercato/ui/backend/utils/apiCall', () => ({
  apiCall: (...args: unknown[]) => mockApiCall(...args),
  withScopedApiRequestHeaders: async (_headers: unknown, operation: () => Promise<unknown>) => operation(),
}))

jest.mock('@open-mercato/ui/backend/utils/optimisticLock', () => ({
  buildOptimisticLockHeader: () => ({}),
}))

jest.mock('@open-mercato/ui/backend/utils/crud', () => ({
  deleteCrud: jest.fn(),
}))

jest.mock('@open-mercato/ui/backend/utils/serverErrors', () => ({
  normalizeCrudServerError: (err: unknown) => ({ message: String(err) }),
}))

jest.mock('@open-mercato/ui/backend/detail', () => ({
  LoadingMessage: () => null,
  TabEmptyState: () => null,
}))

jest.mock('@open-mercato/ui/backend/FlashMessages', () => ({
  flash: jest.fn(),
}))

jest.mock('@open-mercato/ui/backend/confirm-dialog', () => ({
  useConfirmDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    ConfirmDialogElement: null,
  }),
}))

jest.mock('@open-mercato/ui/primitives/button', () => ({
  Button: ({ children, ...props }: { children?: React.ReactNode }) => <button {...props}>{children}</button>,
}))

jest.mock('@open-mercato/ui/backend/injection/useInjectionDataWidgets', () => ({
  useInjectionDataWidgets: () => ({ widgets: [] }),
}))

jest.mock('@open-mercato/ui/backend/markets/MarketProfileProvider', () => ({
  useDisplayProfile: () => activeProfile,
}))

jest.mock('@open-mercato/core/modules/dictionaries/components/dictionaryAppearance', () => ({
  DictionaryValue: () => null,
  createDictionaryMap: () => ({}),
  normalizeDictionaryEntries: () => [],
}))

jest.mock('@open-mercato/core/modules/sales/lib/frontend/documentTotalsEvents', () => ({
  emitSalesDocumentTotalsRefresh: jest.fn(),
}))

jest.mock('../LineItemDialog', () => ({
  LineItemDialog: () => null,
}))

jest.mock('../optimisticLock', () => ({
  handleSectionMutationError: () => false,
}))

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => mockTranslate,
  useLocale: () => TEST_LOCALE,
}))

jest.mock('@open-mercato/shared/lib/frontend/useOrganizationScope', () => ({
  useOrganizationScopeDetail: () => ({ organizationId: 'org-1', tenantId: 'tenant-1' }),
}))

jest.mock('lucide-react', () => ({
  Pencil: () => null,
  Trash2: () => null,
}))

type LinePayload = Record<string, unknown>

function money(value: number): string {
  return new Intl.NumberFormat(TEST_LOCALE, { style: 'currency', currency: 'USD' }).format(value)
}

/** 2 × 500.00 net with 76.13 of sales tax booked against the line. */
function lineFixture(overrides: LinePayload = {}): LinePayload {
  return {
    id: 'line-1',
    name: 'Widget A',
    quantity: 2,
    currency_code: 'USD',
    unit_price_net: 500,
    unit_price_gross: 538.07,
    tax_rate: 7.613,
    tax_amount: 76.13,
    total_net_amount: 1000,
    total_gross_amount: 1076.13,
    discount_amount: 0,
    discount_percent: 0,
    ...overrides,
  }
}

const taxInfo = {
  version: 1,
  status: 'calculated',
  totals: { taxTotal: 76.13, taxableTotal: 1000, exemptTotal: 0 },
  lines: [{ lineId: 'line-1', taxAmount: 76.13 }],
}

function mockLines(...lines: LinePayload[]): void {
  mockApiCall.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/sales/order-lines?')) {
      return { ok: true, result: { items: lines } }
    }
    return { ok: true, result: { items: [] } }
  })
}

function renderSection(props: { taxInfo?: unknown } = {}): void {
  render(
    <SalesDocumentItemsSection
      documentId="order-1"
      kind="order"
      currencyCode="USD"
      organizationId="org-1"
      tenantId="tenant-1"
      {...props}
    />,
  )
}

async function headerLabels(): Promise<string[]> {
  const headers = await screen.findAllByRole('columnheader')
  return headers.map((header) => header.textContent ?? '')
}

async function cellAt(label: string): Promise<string> {
  const labels = await headerLabels()
  const index = labels.indexOf(label)
  expect(index).toBeGreaterThanOrEqual(0)
  const bodyRow = (await screen.findAllByRole('row'))[1]
  return bodyRow.querySelectorAll('td')[index]?.textContent ?? ''
}

describe('SalesDocumentItemsSection under single_price_plus_tax', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    activeProfile = US_DISPLAY_TEMPLATE
  })

  it('replaces the net/gross columns with Price, Line total, Tax and Total including tax', async () => {
    mockLines(lineFixture())
    renderSection({ taxInfo })

    await screen.findByText('Widget A')
    const labels = await headerLabels()
    expect(labels).toEqual(['Product', 'Status', 'Qty', 'Price', 'Line total', 'Tax', 'Total including tax', 'Actions'])
    expect(labels.some((label) => /net|gross/i.test(label))).toBe(false)
  })

  it('fills the tax cells from the document tax result', async () => {
    mockLines(lineFixture())
    renderSection({ taxInfo })

    await screen.findByText('Widget A')
    expect(await cellAt('Price')).toBe(money(500))
    expect(await cellAt('Line total')).toBe(money(1000))
    expect(await cellAt('Tax')).toBe(money(76.13))
    expect(await cellAt('Total including tax')).toBe(money(1076.13))
  })

  it('falls back to the line own tax amount when the tax result does not itemize the line', async () => {
    mockLines(lineFixture())
    renderSection({ taxInfo: { version: 1, lines: [{ lineId: 'other-line', taxAmount: 1 }] } })

    await screen.findByText('Widget A')
    expect(await cellAt('Tax')).toBe(money(76.13))
    expect(await cellAt('Total including tax')).toBe(money(1076.13))
  })

  it('honours a zero the tax result itemized', async () => {
    mockLines(lineFixture())
    renderSection({ taxInfo: { version: 1, lines: [{ lineId: 'line-1', taxAmount: 0 }] } })

    await screen.findByText('Widget A')
    expect(await cellAt('Tax')).toBe(money(0))
    expect(await cellAt('Total including tax')).toBe(money(1000))
  })

  it('shows a dash when the document carries no per line tax at all', async () => {
    mockLines(lineFixture({ tax_amount: 0, tax_rate: 0, total_gross_amount: 1000 }))
    renderSection({ taxInfo: { version: 1, status: 'fallback', lines: [] } })

    await screen.findByText('Widget A')
    expect(await cellAt('Tax')).toBe('—')
    expect(await cellAt('Total including tax')).toBe('—')
  })
})

describe('SalesDocumentItemsSection under dual_net_gross', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps the EU columns and the net/gross pair on every row', async () => {
    activeProfile = EU_DISPLAY_TEMPLATE
    mockLines(lineFixture())
    renderSection({ taxInfo })

    await screen.findByText('Widget A')
    expect(await headerLabels()).toEqual(['Product', 'Status', 'Qty', 'Unit price', 'Total', 'Actions'])
    // The EU template pins a space thousands separator and a comma decimal of its own.
    expect(await cellAt('Total')).toBe('$1 076,13 gross$1 000,00 net')
  })

  it('leaves an organization with no market exactly where it was', async () => {
    activeProfile = null
    mockLines(lineFixture())
    renderSection({ taxInfo })

    await screen.findByText('Widget A')
    expect(await headerLabels()).toEqual(['Product', 'Status', 'Qty', 'Unit price', 'Total', 'Actions'])
  })
})
