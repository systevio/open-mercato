import { randomInt } from 'node:crypto'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'
import { login } from '@open-mercato/core/helpers/integration/auth'
import { getAuthToken } from '@open-mercato/core/helpers/integration/api'
import {
  apiRequestWithSelectedOrg,
  createOrganizationFixture,
  deleteOrganizationIfExists,
} from '@open-mercato/core/helpers/integration/authFixtures'
import { expectId, getTokenContext, readJsonSafe } from '@open-mercato/core/helpers/integration/generalFixtures'

type CurrencySubtotal = {
  currencyCode: string | null
  amount: number
  count: number
  invalidAmountCount: number
}

async function createScopedEntity(
  request: APIRequestContext,
  token: string,
  organizationId: string,
  path: string,
  data: Record<string, unknown>,
): Promise<string> {
  const response = await apiRequestWithSelectedOrg(request, 'POST', path, {
    token,
    selectedOrgId: organizationId,
    data,
  })
  const body = await readJsonSafe<Record<string, unknown>>(response)
  expect(response.ok(), `POST ${path} should succeed`).toBe(true)
  return expectId(
    body?.id ?? body?.entityId ?? body?.companyId ?? body?.dealId,
    `POST ${path} should return an id`,
  )
}

async function deleteScopedEntity(
  request: APIRequestContext,
  token: string,
  organizationId: string,
  path: string,
  id: string | null,
): Promise<void> {
  if (!id) return
  await apiRequestWithSelectedOrg(request, 'DELETE', path, {
    token,
    selectedOrgId: organizationId,
    data: { id },
  }).catch(() => undefined)
}

test.describe('TC-CRM-MARKET-CURRENCY-001: company money display follows market conventions', () => {
  test('separates stored currencies, exposes unknown denominations, and stays organization-scoped', async ({ page, request }) => {
    const token = await getAuthToken(request, 'superadmin')
    const { organizationId: homeOrganizationId, tenantId } = getTokenContext(token)
    const stamp = `${Date.now()}-${randomInt(1_000_000)}`
    let organizationId: string | null = null
    let companyId: string | null = null
    const dealIds: string[] = []

    try {
      organizationId = await createOrganizationFixture(request, token, {
        name: `QA market currency ${stamp}`,
        tenantId,
      })

      const profileResponse = await apiRequestWithSelectedOrg(request, 'PUT', '/api/markets/display-profile', {
        token,
        selectedOrgId: organizationId,
        data: US_DISPLAY_TEMPLATE,
      })
      expect(profileResponse.status(), 'US market profile should save in the isolated organization').toBe(200)

      companyId = await createScopedEntity(
        request,
        token,
        organizationId,
        '/api/customers/companies',
        { displayName: `QA market currency company ${stamp}` },
      )
      for (const input of [
        { title: `QA PLN deal ${stamp}`, valueAmount: 1200, valueCurrency: 'PLN' },
        { title: `QA USD deal ${stamp}`, valueAmount: 300, valueCurrency: 'USD' },
        { title: `QA unknown deal ${stamp}`, valueAmount: 50 },
      ]) {
        dealIds.push(await createScopedEntity(
          request,
          token,
          organizationId,
          '/api/customers/deals',
          { ...input, companyIds: [companyId], status: 'open' },
        ))
      }

      const detailResponse = await apiRequestWithSelectedOrg(
        request,
        'GET',
        `/api/customers/companies/${companyId}`,
        { token, selectedOrgId: organizationId },
      )
      const detail = await readJsonSafe<{
        kpis?: { activeDealsValue?: number | null; activeDealsByCurrency?: CurrencySubtotal[] }
      }>(detailResponse)
      expect(detailResponse.status()).toBe(200)
      expect(detail?.kpis?.activeDealsValue, 'mixed denominations must not collapse into one scalar').toBeNull()
      expect(detail?.kpis?.activeDealsByCurrency).toEqual([
        { currencyCode: 'PLN', amount: 1200, count: 1, invalidAmountCount: 0 },
        { currencyCode: 'USD', amount: 300, count: 1, invalidAmountCount: 0 },
        { currencyCode: null, amount: 50, count: 1, invalidAmountCount: 0 },
      ])

      const crossOrganizationResponse = await apiRequestWithSelectedOrg(
        request,
        'GET',
        `/api/customers/companies/${companyId}`,
        { token, selectedOrgId: homeOrganizationId },
      )
      expect(crossOrganizationResponse.status(), 'the isolated company must not leak into the home organization').toBe(404)

      await login(page, 'superadmin')
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
      await page.context().addCookies([
        { name: 'om_selected_tenant', value: tenantId, url: baseUrl, sameSite: 'Lax' },
        { name: 'om_selected_org', value: organizationId, url: baseUrl, sameSite: 'Lax' },
      ])
      await page.goto(`/backend/customers/companies-v2/${companyId}`, { waitUntil: 'domcontentloaded' })

      const activeDealsCard = page.getByText('ACTIVE DEALS').locator('..').locator('..')
      await expect(activeDealsCard.getByText('Multiple currencies')).toBeVisible()
      await expect(activeDealsCard.getByText(/PLN\s*1,200\.00/)).toBeVisible()
      await expect(activeDealsCard.getByText(/\$300\.00/)).toBeVisible()
      await expect(activeDealsCard.getByText(/Currency unavailable:\s*50/)).toBeVisible()
      await expect(activeDealsCard.getByText('3 deals')).toBeVisible()
    } finally {
      if (organizationId) {
        for (const dealId of dealIds.reverse()) {
          await deleteScopedEntity(request, token, organizationId, '/api/customers/deals', dealId)
        }
        await deleteScopedEntity(request, token, organizationId, '/api/customers/companies', companyId)
        await apiRequestWithSelectedOrg(request, 'DELETE', '/api/markets/display-profile', {
          token,
          selectedOrgId: organizationId,
          data: {},
        }).catch(() => undefined)
      }
      await deleteOrganizationIfExists(request, token, organizationId)
    }
  })
})
