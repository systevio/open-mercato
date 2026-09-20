import { formatMoney, formatNumber } from '@open-mercato/shared/lib/display/money'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'

export function formatWarrantyAmount(
  value: string | number | null | undefined,
  currencyCode: string | null | undefined,
  profile?: DisplayProfile | null,
  locale?: string | null,
): string | null {
  if (value === null || value === undefined || value === '') return null
  return currencyCode
    ? formatMoney(value, currencyCode, profile, { locale })
    : formatNumber(value, profile, { locale })
}
