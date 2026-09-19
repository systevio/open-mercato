"use client"

import * as React from 'react'
import { EyeOff } from 'lucide-react'
import { useT, useLocale } from '@open-mercato/shared/lib/i18n/context'
import { formatNumber } from '@open-mercato/shared/lib/display/money'
import { KpiCard, type KpiTrend } from '@open-mercato/ui/backend/charts/KpiCard'
import { useDisplayProfile } from '@open-mercato/ui/backend/markets/MarketProfileProvider'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import {
  readVersionedIdSet,
  writeVersionedIdSet,
  clearVersionedPreference,
} from '@open-mercato/shared/lib/browser/versionedPreference'
import { isOpenDealStatus, isWonDealStatus } from '../../lib/dealStatus'
import type { CompanyCurrencySubtotal, CompanyOverview, DealSummary, InteractionSummary } from '../formConfig'
import { formatCurrency } from './utils'

const STORAGE_KEY = 'om:company-detail-kpi-hidden'
const STORAGE_VERSION = 1

function getActiveDeals(deals: DealSummary[]): DealSummary[] {
  return deals.filter((d) => isOpenDealStatus(d.status))
}

function computeActivityTrend(interactions: InteractionSummary[]): KpiTrend | undefined {
  const now = Date.now()
  const weekMs = 7 * 86_400_000
  const thisWeek = interactions.filter((i) => {
    const d = i.occurredAt ?? i.scheduledAt
    return d && now - new Date(d).getTime() < weekMs
  }).length
  const lastWeek = interactions.filter((i) => {
    const d = i.occurredAt ?? i.scheduledAt
    if (!d) return false
    const diff = now - new Date(d).getTime()
    return diff >= weekMs && diff < weekMs * 2
  }).length
  if (lastWeek === 0 && thisWeek === 0) return undefined
  if (lastWeek === 0) return { value: 100, direction: 'up' }
  const pct = ((thisWeek - lastWeek) / lastWeek) * 100
  if (Math.abs(pct) < 0.5) return { value: 0, direction: 'unchanged' }
  return { value: Math.abs(pct), direction: pct > 0 ? 'up' : 'down' }
}

function computeDealTrend(deals: DealSummary[]): KpiTrend | undefined {
  const active = deals.filter((d) => isOpenDealStatus(d.status))
  if (active.length === 0) return undefined
  const now = Date.now()
  const monthMs = 30 * 86_400_000
  const recentDeals = active.filter((d) => d.createdAt && now - new Date(d.createdAt).getTime() < monthMs).length
  if (recentDeals > 0) return { value: recentDeals * 10, direction: 'up' }
  return { value: 0, direction: 'unchanged' }
}

type CompanyKpiBarProps = {
  data: CompanyOverview
}

type MoneyTilePresentation = {
  value: number | null
  formatValue?: (value: number) => string
  comparisonLabel?: string
  footer?: React.ReactNode
}

export function CompanyKpiBar({ data }: CompanyKpiBarProps) {
  const t = useT()
  const locale = useLocale()
  const displayProfile = useDisplayProfile()

  const activeDeals = React.useMemo(() => getActiveDeals(data.deals), [data.deals])
  const activityTrend = React.useMemo(
    () => data.kpis?.activityTrend ?? computeActivityTrend(data.interactions),
    [data.interactions, data.kpis?.activityTrend],
  )
  const dealTrend = React.useMemo(() => computeDealTrend(data.deals), [data.deals])

  const clientTenureYears = React.useMemo(() => {
    if (data.kpis?.clientTenureYears !== undefined) return data.kpis.clientTenureYears
    const allDates = data.interactions
      .map((i) => i.occurredAt ?? i.scheduledAt ?? i.createdAt)
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
    if (allDates.length === 0) return null
    const earliest = Math.min(...allDates)
    return Math.floor((Date.now() - earliest) / (365.25 * 86_400_000))
  }, [data.interactions, data.kpis?.clientTenureYears])

  const [hiddenTiles, setHiddenTiles] = React.useState<Set<string>>(
    () => readVersionedIdSet(STORAGE_KEY, STORAGE_VERSION),
  )

  const toggleTile = React.useCallback((tileId: string) => {
    setHiddenTiles((prev) => {
      const next = new Set(prev)
      if (next.has(tileId)) next.delete(tileId)
      else next.add(tileId)
      writeVersionedIdSet(STORAGE_KEY, STORAGE_VERSION, next)
      return next
    })
  }, [])

  const showAllTiles = React.useCallback(() => {
    setHiddenTiles(new Set())
    clearVersionedPreference(STORAGE_KEY)
  }, [])

  const renderCurrencySubtotal = React.useCallback((subtotal: CompanyCurrencySubtotal): string => {
    if (subtotal.invalidAmountCount === subtotal.count) {
      return t('customers.companies.dashboard.kpi.amountUnavailable', 'Amount unavailable')
    }
    const formatted = subtotal.currencyCode
      ? formatCurrency(subtotal.amount, subtotal.currencyCode, locale, displayProfile)
      : formatNumber(subtotal.amount, displayProfile, { locale }) ?? String(subtotal.amount)
    const denomination = subtotal.currencyCode
      ? formatted
      : `${t('customers.companies.dashboard.kpi.currencyUnavailable', 'Currency unavailable')}: ${formatted}`
    if (subtotal.invalidAmountCount === 0) return denomination
    return `${denomination} · ${t('customers.companies.dashboard.kpi.incompleteTotal', 'Incomplete total')}`
  }, [displayProfile, locale, t])

  const buildMoneyTile = React.useCallback((
    groups: CompanyCurrencySubtotal[] | undefined,
    emptyValue: number | null,
  ): MoneyTilePresentation => {
    if (groups === undefined) {
      return {
        value: null,
        comparisonLabel: t('customers.companies.dashboard.kpi.totalUnavailable', 'Total unavailable'),
      }
    }
    if (groups.length === 0) {
      return {
        value: emptyValue,
        formatValue: emptyValue === null
          ? undefined
          : (value: number) => formatCurrency(value, null, locale, displayProfile),
      }
    }
    if (groups.length === 1) {
      const [group] = groups
      const hasValidAmount = group.invalidAmountCount < group.count
      return {
        value: hasValidAmount ? group.amount : null,
        formatValue: hasValidAmount ? () => renderCurrencySubtotal(group) : undefined,
        comparisonLabel: !hasValidAmount
          ? t('customers.companies.dashboard.kpi.amountUnavailable', 'Amount unavailable')
          : group.invalidAmountCount > 0
            ? t('customers.companies.dashboard.kpi.incompleteTotal', 'Incomplete total')
            : undefined,
      }
    }
    return {
      value: 0,
      formatValue: () => t('customers.companies.dashboard.kpi.multipleCurrencies', 'Multiple currencies'),
      footer: (
        <ul className="space-y-1" aria-label={t('customers.companies.dashboard.kpi.currencyBreakdown', 'Currency breakdown')}>
          {groups.map((group) => (
            <li key={group.currencyCode ?? 'unknown'} className="text-xs text-muted-foreground">
              {renderCurrencySubtotal(group)}
            </li>
          ))}
        </ul>
      ),
    }
  }, [displayProfile, locale, renderCurrencySubtotal, t])

  const activeMoney = React.useMemo(
    () => buildMoneyTile(data.kpis?.activeDealsByCurrency, 0),
    [buildMoneyTile, data.kpis?.activeDealsByCurrency],
  )
  const wonMoney = React.useMemo(
    () => buildMoneyTile(data.kpis?.wonDealsByCurrency, null),
    [buildMoneyTile, data.kpis?.wonDealsByCurrency],
  )
  const activeDealsCount = data.kpis?.activeDealsCount ?? activeDeals.length

  const kpiTiles = React.useMemo(() => [
    {
      id: 'activeDeals',
      title: t('customers.companies.dashboard.kpi.activeDeals', 'ACTIVE DEALS'),
      value: activeMoney.value,
      trend: dealTrend,
      formatValue: activeMoney.formatValue,
      comparisonLabel: activeMoney.comparisonLabel ?? t(
        activeDealsCount === 1
          ? 'customers.companies.dashboard.kpi.dealCount.one'
          : 'customers.companies.dashboard.kpi.dealCount.other',
        activeDealsCount === 1 ? '{{count}} deal' : '{{count}} deals',
        { count: activeDealsCount },
      ),
      footer: activeMoney.footer,
    },
    {
      id: 'activities',
      title: t('customers.companies.dashboard.kpi.activities', 'ACTIVITIES'),
      value: data.kpis?.activityCount ?? data.interactions.length,
      trend: activityTrend,
      comparisonLabel: t('customers.companies.dashboard.kpi.last12months', 'last 12 months'),
    },
    {
      id: 'ltv',
      title: t('customers.companies.dashboard.kpi.ltv', 'CUSTOMER VALUE (LTV)'),
      value: wonMoney.value,
      formatValue: wonMoney.formatValue,
      comparisonLabel: wonMoney.comparisonLabel ?? (wonMoney.value !== null
        ? t('customers.companies.dashboard.kpi.wonDeals', 'won deals total')
        : t('customers.companies.dashboard.kpi.noWonDeals', 'No won deals')),
      footer: wonMoney.footer,
    },
    {
      id: 'clientSince',
      title: t('customers.companies.dashboard.kpi.clientSince', 'CLIENT SINCE'),
      value: clientTenureYears,
      formatValue: clientTenureYears !== null
        ? (v: number) => v < 1
          ? `< 1 ${t('customers.companies.dashboard.kpi.year', 'year')}`
          : `${v} ${v === 1 ? t('customers.companies.dashboard.kpi.year', 'year') : t('customers.companies.dashboard.kpi.years', 'years')}`
        : undefined,
      comparisonLabel: clientTenureYears !== null
        ? `${data.kpis?.completedDealsCount ?? data.deals.filter((d) => isWonDealStatus(d.status)).length} ${t('customers.companies.dashboard.kpi.completedDeals', 'completed deals')}`
        : t('customers.companies.dashboard.kpi.noInteractions', 'No interactions yet'),
    },
  ], [t, activeMoney, dealTrend, activeDealsCount, activityTrend, wonMoney, clientTenureYears, data.deals, data.interactions.length, data.kpis])

  const visibleTiles = kpiTiles.filter((tile) => !hiddenTiles.has(tile.id))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleTiles.map((tile) => (
          <div key={tile.id} className="group relative">
            <KpiCard
              title={tile.title}
              value={tile.value}
              trend={tile.trend}
              formatValue={tile.formatValue}
              comparisonLabel={tile.comparisonLabel}
              footer={tile.footer}
            />
            <IconButton
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => toggleTile(tile.id)}
              className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-60"
              aria-label={t('customers.companies.dashboard.hideTile', 'Hide tile')}
            >
              <EyeOff className="size-3.5" />
            </IconButton>
          </div>
        ))}
      </div>
      {hiddenTiles.size > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t('customers.companies.dashboard.hiddenTiles', '{{count}} tiles hidden', { count: hiddenTiles.size })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-1.5 py-0.5 text-xs hover:bg-transparent"
            onClick={showAllTiles}
          >
            {t('customers.companies.dashboard.showAll', 'Show all')}
          </Button>
        </div>
      )}
    </div>
  )
}
