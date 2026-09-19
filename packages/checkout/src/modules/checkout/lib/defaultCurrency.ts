export function resolvePristineCurrencyDefault(
  profileCurrencyCode: string | null | undefined,
  supportedCurrencyCodes: readonly string[],
  legacyDefault = 'USD',
): string {
  const supported = supportedCurrencyCodes
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code))
  const profileCode = profileCurrencyCode?.trim().toUpperCase() ?? ''
  if (profileCode && supported.includes(profileCode)) return profileCode
  return supported[0] ?? legacyDefault
}
