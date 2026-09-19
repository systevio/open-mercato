import { formatMoney, formatNumber } from '@open-mercato/shared/lib/display/money'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'

export type FormatCurrencyOptions = {
  currency?: string | null
  locale?: string
  profile?: DisplayProfile | null
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export type FormatCurrencyCompactOptions = {
  currency?: string | null
  locale?: string
  profile?: DisplayProfile | null
}

const CURRENCY_CODE_PATTERN = /^[A-Za-z]{3}$/
const NUMBER_FORMATTER_CACHE_LIMIT = 128
const numberFormatterCache = new Map<string, Intl.NumberFormat>()

function normalizeCurrencyCode(currency?: string | null): string | null {
  if (typeof currency !== 'string') return null
  const trimmed = currency.trim()
  if (!CURRENCY_CODE_PATTERN.test(trimmed)) return null
  return trimmed.toUpperCase()
}

function getNumberFormatter(
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale ?? ''}:${JSON.stringify(options)}`
  const cached = numberFormatterCache.get(key)
  if (cached) return cached
  const formatter = new Intl.NumberFormat(locale, options)
  if (numberFormatterCache.size >= NUMBER_FORMATTER_CACHE_LIMIT) {
    const oldest = numberFormatterCache.keys().next().value
    if (oldest) numberFormatterCache.delete(oldest)
  }
  numberFormatterCache.set(key, formatter)
  return formatter
}

function formatDecimal(
  value: number,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  locale?: string,
): string {
  return getNumberFormatter(locale, {
    style: 'decimal',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value)
}

/**
 * Formats a monetary amount. Without a currency code the amount renders as a plain
 * number: analytics values carry no currency of their own, and labelling them with a
 * guessed one (see #4620) is worse than leaving them unlabelled.
 */
export function formatCurrency(value: number, options: FormatCurrencyOptions = {}): string {
  const { currency, locale, profile, minimumFractionDigits = 0, maximumFractionDigits = 0 } = options
  const code = normalizeCurrencyCode(currency)
  if (!profile) {
    if (!code) return formatDecimal(value, minimumFractionDigits, maximumFractionDigits, locale)
    try {
      return getNumberFormatter(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(value)
    } catch {
      return `${formatDecimal(value, minimumFractionDigits, maximumFractionDigits, locale)} ${code}`
    }
  }
  const formatOptions = { locale, minimumFractionDigits, maximumFractionDigits }
  if (!code) return formatNumber(value, profile, formatOptions) ?? ''
  return formatMoney(value, code, profile, formatOptions) ?? ''
}

export function formatCurrencyWithDecimals(value: number, options: FormatCurrencyOptions = {}): string {
  return formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options })
}

function formatWithLiteralSymbol(value: number, symbol: string): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(1)}K`
  }
  return `${symbol}${value.toFixed(0)}`
}

export function formatCurrencyCompact(
  value: number,
  currencyOrOptions: string | null | FormatCurrencyCompactOptions = {},
): string {
  if (typeof currencyOrOptions === 'string' && !normalizeCurrencyCode(currencyOrOptions)) {
    return formatWithLiteralSymbol(value, currencyOrOptions)
  }

  const options = typeof currencyOrOptions === 'string'
    ? { currency: currencyOrOptions }
    : (currencyOrOptions ?? {})
  const code = normalizeCurrencyCode(options.currency)
  const compact = Math.abs(value) >= 1_000
  if (options.profile) {
    const profileOptions = {
      locale: options.locale,
      notation: compact ? 'compact' as const : 'standard' as const,
      minimumFractionDigits: compact ? 1 : 0,
      maximumFractionDigits: compact ? 1 : 0,
    }
    return code
      ? (formatMoney(value, code, options.profile, profileOptions) ?? '')
      : (formatNumber(value, options.profile, profileOptions) ?? '')
  }
  const formatOptions: Intl.NumberFormatOptions = {
    style: code ? 'currency' : 'decimal',
    notation: compact ? 'compact' : 'standard',
    compactDisplay: 'short',
    minimumFractionDigits: compact ? 1 : 0,
    maximumFractionDigits: compact ? 1 : 0,
  }
  if (code) formatOptions.currency = code

  try {
    return getNumberFormatter(options.locale, formatOptions).format(value)
  } catch {
    const formatted = getNumberFormatter(options.locale, {
      style: 'decimal',
      notation: compact ? 'compact' : 'standard',
      compactDisplay: 'short',
      minimumFractionDigits: compact ? 1 : 0,
      maximumFractionDigits: compact ? 1 : 0,
    }).format(value)
    return code ? `${formatted} ${code}` : formatted
  }
}

export function formatCurrencySafe(
  value: unknown,
  fallback = '--',
  options: FormatCurrencyOptions = {},
): string {
  if (value === null || value === undefined) return fallback
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return formatCurrency(num, options)
}

export type CurrencyFormatters = {
  currency: string | null
  format: (value: number) => string
  formatWithDecimals: (value: number) => string
  formatCompact: (value: number) => string
  formatSafe: (value: unknown) => string
}

/**
 * Binds the resolved currency once so widgets can hand chart and KPI components a
 * stable single-argument formatter — passing `formatCurrency` by reference is what
 * made its currency option unreachable in the first place (#4620).
 */
export function createCurrencyFormatters(
  currency?: string | null,
  fallback = '--',
  locale?: string,
  profile?: DisplayProfile | null,
): CurrencyFormatters {
  const code = normalizeCurrencyCode(currency)
  return {
    currency: code,
    format: (value: number) => formatCurrency(value, { currency: code, locale, profile }),
    formatWithDecimals: (value: number) => formatCurrencyWithDecimals(value, { currency: code, locale, profile }),
    formatCompact: (value: number) => formatCurrencyCompact(value, { currency: code, locale, profile }),
    formatSafe: (value: unknown) => formatCurrencySafe(value, fallback, { currency: code, locale, profile }),
  }
}
