/**
 * @jest-environment jsdom
 */
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@open-mercato/shared/lib/testing/renderWithProviders'
import { CompanyKpiBar } from '../CompanyKpiBar'
import type { CompanyOverview, DealSummary } from '../../formConfig'
import { MarketProfileProvider } from '@open-mercato/ui/backend/markets/MarketProfileProvider'
import { getMarketTemplate } from '@open-mercato/shared/lib/display/templates'

// Regression for issue #4667: a deal closed through useDealClosure persists
// `status: 'win'`, but this bar tested for `won` / `lost` / `closed`. Every closed deal
// therefore stayed in ACTIVE DEALS and the LTV fallback read 0 for a tenant that closes
// deals entirely through the supported UI. The assertions below read the tile values
// because KpiCard only renders `comparisonLabel` alongside a trend.

const CLOSED_WON_DEAL: DealSummary = {
  id: 'deal-won',
  title: 'Closed through useDealClosure',
  status: 'win',
  closureOutcome: 'won',
  valueAmount: 4000,
  valueCurrency: 'PLN',
  createdAt: '2026-01-10T10:00:00.000Z',
}

const CLOSED_LOST_DEAL: DealSummary = {
  id: 'deal-lost',
  title: 'Lost through useDealClosure',
  status: 'loose',
  closureOutcome: 'lost',
  valueAmount: 2500,
  valueCurrency: 'PLN',
  createdAt: '2026-01-11T10:00:00.000Z',
}

const AI_CLOSED_WON_DEAL: DealSummary = {
  id: 'deal-ai-won',
  title: 'Closed through customers.update_deal_stage',
  status: 'won',
  valueAmount: 900,
  valueCurrency: 'PLN',
  createdAt: '2026-01-09T10:00:00.000Z',
}

const OPEN_DEAL: DealSummary = {
  id: 'deal-open',
  title: 'Still negotiating',
  status: 'negotiations',
  valueAmount: 1000,
  valueCurrency: 'PLN',
  createdAt: '2026-01-12T10:00:00.000Z',
}

const TENANT_STAGE_DEAL: DealSummary = {
  id: 'deal-tenant-stage',
  title: 'Awaiting legal sign-off',
  status: 'awaiting_legal_signoff',
  valueAmount: 700,
  valueCurrency: 'PLN',
  createdAt: '2026-01-13T10:00:00.000Z',
}

function buildOverview(deals: DealSummary[]): CompanyOverview {
  return {
    company: { id: 'company-1', displayName: 'Acme Corp' },
    profile: null,
    customFields: {},
    tags: [],
    comments: [],
    activities: [],
    interactions: [],
    deals,
    todos: [],
    people: [],
  }
}

function tile(title: string): HTMLElement {
  const card = screen.getByText(title).closest('div.rounded-lg')
  if (!card) throw new Error(`[internal] KPI tile "${title}" is not rendered`)
  return card as HTMLElement
}

const ACTIVE_DEALS = 'ACTIVE DEALS'
const LTV = 'CUSTOMER VALUE (LTV)'

// The tile values below are Intl-formatted, so the locale is pinned explicitly (#5105) instead of
// inheriting the runner's default — CompanyKpiBar formats through the app locale, which
// `renderWithProviders` supplies via I18nProvider.
const EN = 'en-US'

function renderBar(deals: DealSummary[], locale = EN) {
  return renderWithProviders(<CompanyKpiBar data={buildOverview(deals)} />, { locale })
}

describe('CompanyKpiBar — deal status vocabulary (#4667)', () => {
  it('keeps a win deal out of the active total and counts it as won', () => {
    renderBar([CLOSED_WON_DEAL, OPEN_DEAL])

    expect(within(tile(ACTIVE_DEALS)).getByText('PLN 1,000')).toBeInTheDocument()
    expect(within(tile(ACTIVE_DEALS)).getByText('1 deal')).toBeInTheDocument()
    expect(within(tile(LTV)).getByText('PLN 4,000')).toBeInTheDocument()
  })

  it('also recognises the won spelling the AI stage tool persists', () => {
    renderBar([AI_CLOSED_WON_DEAL, OPEN_DEAL])

    expect(within(tile(ACTIVE_DEALS)).getByText('PLN 1,000')).toBeInTheDocument()
    expect(within(tile(LTV)).getByText('PLN 900')).toBeInTheDocument()
  })

  it('leaves the LTV tile empty while every deal is still open', () => {
    renderBar([OPEN_DEAL, TENANT_STAGE_DEAL])

    expect(within(tile(ACTIVE_DEALS)).getByText('PLN 1,700')).toBeInTheDocument()
    expect(within(tile(ACTIVE_DEALS)).getByText('2 deals')).toBeInTheDocument()
    expect(within(tile(LTV)).getByText('--')).toBeInTheDocument()
  })

  it('reports an empty active total when both deals were closed through the UI', () => {
    renderBar([CLOSED_WON_DEAL, CLOSED_LOST_DEAL])

    expect(within(tile(ACTIVE_DEALS)).getByText('PLN 0')).toBeInTheDocument()
    expect(within(tile(LTV)).getByText('PLN 4,000')).toBeInTheDocument()
  })

  it('formats the tile values in the app locale rather than the runtime default', () => {
    renderBar([CLOSED_WON_DEAL, OPEN_DEAL], 'pl-PL')

    expect(within(tile(ACTIVE_DEALS)).getByText(/^1000\s+zł$/)).toBeInTheDocument()
    expect(within(tile(LTV)).getByText(/^4000\s+zł$/)).toBeInTheDocument()
  })

  it('keeps mixed and unknown denominations separate under the US profile', () => {
    const overview = buildOverview([])
    overview.kpis = {
      activeDealsCount: 4,
      activeDealsValue: null,
      dealCurrency: null,
      activeDealsByCurrency: [
        { currencyCode: 'PLN', amount: 1200, count: 1, invalidAmountCount: 0 },
        { currencyCode: 'USD', amount: 300, count: 1, invalidAmountCount: 0 },
        { currencyCode: null, amount: 50, count: 1, invalidAmountCount: 0 },
        { currencyCode: 'EUR', amount: 0, count: 1, invalidAmountCount: 1 },
      ],
      activityCount: 0,
      activityTrend: null,
      ltvValue: null,
      wonDealsByCurrency: [],
      completedDealsCount: 0,
      clientTenureYears: null,
    }
    const usProfile = getMarketTemplate('US')
    if (!usProfile) throw new Error('[internal] US market template is unavailable')

    renderWithProviders(
      <MarketProfileProvider profile={usProfile}>
        <CompanyKpiBar data={overview} />
      </MarketProfileProvider>,
      { locale: EN },
    )

    const activeTile = within(tile(ACTIVE_DEALS))
    expect(activeTile.getByText(/PLN/)).toHaveTextContent('1,200')
    expect(activeTile.getByText(/\$300/)).toBeInTheDocument()
    expect(activeTile.getByText(/Currency unavailable/)).toHaveTextContent('50')
    expect(activeTile.getByText(/EUR/)).toHaveTextContent('Amount unavailable')
    expect(activeTile.getByText('4 deals')).toBeInTheDocument()
  })
})
