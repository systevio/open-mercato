export type CurrencySubtotal = {
  currencyCode: string | null
  amount: number
  count: number
  invalidAmountCount: number
}

type MonetaryRecord = {
  valueAmount?: string | number | null
  valueCurrency?: string | null
}

export function parseMoneyAmount(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.length) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeCurrencyCode(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null
}

export function groupCurrencySubtotals(records: MonetaryRecord[]): CurrencySubtotal[] {
  const groups = new Map<string | null, CurrencySubtotal>()

  for (const record of records) {
    const currencyCode = normalizeCurrencyCode(record.valueCurrency)
    const current = groups.get(currencyCode) ?? {
      currencyCode,
      amount: 0,
      count: 0,
      invalidAmountCount: 0,
    }
    const amount = parseMoneyAmount(record.valueAmount)
    current.count += 1
    if (amount === null) current.invalidAmountCount += 1
    else current.amount += amount
    groups.set(currencyCode, current)
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.currencyCode === null) return right.currencyCode === null ? 0 : 1
    if (right.currencyCode === null) return -1
    return left.currencyCode.localeCompare(right.currencyCode)
  })
}
