import { formatMoney, formatNumber } from '@open-mercato/shared/lib/display/money'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'

export function formatCurrency(
  amount: string | null,
  currency: string | null,
  profile?: DisplayProfile | null,
  locale?: string,
): string | null {
  if (!amount) return null
  const parsed = Number(amount)
  if (!Number.isFinite(parsed)) return currency ? `${amount} ${currency}` : amount
  if (!profile) {
    if (!currency) return parsed.toLocaleString()
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(parsed)
    } catch {
      return `${parsed.toLocaleString()} ${currency}`
    }
  }
  return currency
    ? formatMoney(parsed, currency, profile, { locale })
    : formatNumber(parsed, profile, { locale })
}

export function startOfNextQuarter(baseDate: Date): Date {
  const year = baseDate.getFullYear()
  const currentQuarter = Math.floor(baseDate.getMonth() / 3)
  const nextQuarter = currentQuarter + 1
  if (nextQuarter >= 4) return new Date(year + 1, 0, 1, 10, 0, 0, 0)
  return new Date(year, nextQuarter * 3, 1, 10, 0, 0, 0)
}
