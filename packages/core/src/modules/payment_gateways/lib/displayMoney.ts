import { formatMoney } from '@open-mercato/shared/lib/display/money'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'

export function formatGatewayTransactionAmount(
  value: string | number,
  currencyCode: string,
  profile?: DisplayProfile | null,
): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return `${value} ${currencyCode}`.trim()
  return formatMoney(numeric, currencyCode, profile) ?? `${value} ${currencyCode}`.trim()
}
