import { formatMoney, formatNumber } from '@open-mercato/shared/lib/display/money'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'

export function formatCheckoutMoney(
  amount: string | number | null | undefined,
  currencyCode: string | null | undefined,
  profile?: DisplayProfile | null,
  locale?: string | null,
): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount ?? 0)
  const value = Number.isFinite(numeric) ? numeric : 0
  if (!profile) {
    if (currencyCode) {
      try {
        return new Intl.NumberFormat(locale ?? undefined, { style: 'currency', currency: currencyCode }).format(value)
      } catch {
        return `${value.toFixed(2)} ${currencyCode}`
      }
    }
    return new Intl.NumberFormat(locale ?? undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  return currencyCode
    ? formatMoney(value, currencyCode, profile, { locale }) ?? '0'
    : formatNumber(value, profile, { locale }) ?? '0'
}
