"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'

/**
 * The built in provider key, duplicated from `lib/providers/taxContext` on purpose: that module
 * pulls in the entity manager and the catalog entities, so importing it here would drag server
 * code into every client bundle that renders a line dialog.
 */
export const DEFAULT_TAX_PROVIDER_KEY = 'table-rates'

type TaxProviderSelectionResponse = { providerKey?: unknown }

export type TaxProviderSelection = {
  /** The organization's selected provider, or the built in key while unresolved. */
  providerKey: string
  /** True only once a provider other than the built in one has actually been read. */
  isExternalProvider: boolean
  isLoading: boolean
}

const BUILT_IN_SELECTION: TaxProviderSelection = {
  providerKey: DEFAULT_TAX_PROVIDER_KEY,
  isExternalProvider: false,
  isLoading: false,
}

/**
 * The organization's selected tax provider, for UI that has to know whether tax is computed by an
 * external provider after the write rather than from the tax class picked on the line.
 *
 * Fails to the built in provider on every unhappy path — a failed request, a body without a
 * `providerKey`, and notably a 403 for a user who may edit documents but not sales settings
 * (`GET /api/sales/settings/tax-provider` requires `sales.settings.manage`, while editing lines
 * only requires `sales.orders.manage`). That direction is the safe one: the tax class selector
 * stays visible and the line keeps being saved exactly as it is today. Hiding it on a failed read
 * would instead strip a control the built in provider genuinely needs.
 */
export function useTaxProviderSelection(options?: { enabled?: boolean }): TaxProviderSelection {
  const enabled = options?.enabled ?? true
  const scopeVersion = useOrganizationScopeVersion()
  const [selection, setSelection] = React.useState<TaxProviderSelection>(BUILT_IN_SELECTION)

  React.useEffect(() => {
    if (!enabled) {
      setSelection(BUILT_IN_SELECTION)
      return
    }
    let cancelled = false
    setSelection((current) => ({ ...current, isLoading: true }))
    void apiCall<TaxProviderSelectionResponse>('/api/sales/settings/tax-provider', undefined, {
      fallback: {},
    })
      .then((response) => {
        if (cancelled) return
        const providerKey =
          response.ok && typeof response.result?.providerKey === 'string' && response.result.providerKey.trim().length
            ? response.result.providerKey.trim()
            : DEFAULT_TAX_PROVIDER_KEY
        setSelection({
          providerKey,
          isExternalProvider: providerKey !== DEFAULT_TAX_PROVIDER_KEY,
          isLoading: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setSelection(BUILT_IN_SELECTION)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, scopeVersion])

  return selection
}
