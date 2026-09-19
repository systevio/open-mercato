import { formatMoney, formatNumber } from '@open-mercato/shared/lib/display/money'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'

export function formatCheckoutMoney(
  amount: string | number | null | undefined,
  currencyCode: string | null | undefined,
  profile?: DisplayProfile | null,
  locale?: string | null,
): string {
  const value = amount ?? 0
  return currencyCode
    ? formatMoney(value, currencyCode, profile, { locale }) ?? '0'
    : formatNumber(value, profile, { locale }) ?? '0'
}
