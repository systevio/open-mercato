import type React from 'react'
import { toDateInputValue as toDateInputValueOrNull } from '@open-mercato/shared/lib/date/format'
import { formatMoney, formatNumber } from '@open-mercato/shared/lib/display/money'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'

export function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function toDateInputValue(value: string | null | undefined): string {
  return toDateInputValueOrNull(value) ?? ''
}

export function openNativeDatePicker(event: React.SyntheticEvent<HTMLInputElement>) {
  const input = event.currentTarget
  if (typeof input.showPicker === 'function') {
    input.showPicker()
  }
}

export function formatAmount(
  value: string,
  currency: string | null,
  locale?: string,
  profile?: DisplayProfile | null,
): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--'
  if (!profile) {
    try {
      if (currency && currency.trim().length > 0) {
        return new Intl.NumberFormat(locale ?? undefined, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numeric)
      }
      return new Intl.NumberFormat(locale ?? undefined, {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numeric)
    } catch {
      return String(numeric)
    }
  }
  if (currency && currency.trim().length > 0) {
    return formatMoney(numeric, currency, profile, {
      locale,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) ?? '--'
  }
  return formatNumber(numeric, profile, {
    locale,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) ?? '--'
}
