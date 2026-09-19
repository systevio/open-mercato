/** @jest-environment node */

/**
 * POST /api/sales/documents/recalculate-tax passes its validated fields as the
 * command input itself, the way every other custom sales route does. The
 * command used to read them from an `input.body` wrapper instead, so both hooks
 * saw `undefined` and every click of the "Recalculate tax" button answered 400.
 *
 * The assertions in api/__tests__/recalculate-tax.route.test.ts read the two
 * files as text and mock the command bus, so they cannot see a wrapper
 * mismatch. These run the real command with the exact object the route sends.
 */

import { createContainer, asValue, InjectionMode } from 'awilix'
import { commandRegistry } from '@open-mercato/shared/lib/commands/registry'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { SalesOrder, SalesQuote } from '../../data/entities'

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({
    locale: 'en',
    dict: {},
    t: (key: string) => key,
    translate: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

type EmWithFindOne = {
  findOne: (entityClass: unknown, where: unknown) => Promise<unknown>
}

jest.mock('@open-mercato/shared/lib/encryption/find', () => ({
  findWithDecryption: jest.fn(async () => []),
  findOneWithDecryption: jest.fn(
    async (em: EmWithFindOne, entityClass: unknown, where: unknown) => em.findOne(entityClass, where),
  ),
}))

jest.mock('@open-mercato/shared/lib/crud/custom-fields', () => ({
  loadCustomFieldValues: jest.fn(async () => ({})),
}))

jest.mock('../../lib/providers/taxContext', () => ({
  resolveTaxDocumentContext: jest.fn(async () => ({})),
}))

const ORG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORDER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const QUOTE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const CALCULATED_AT = '2026-09-19T22:40:00.000Z'

function makeDocument(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    organizationId: ORG_ID,
    tenantId: TENANT_ID,
    currencyCode: 'USD',
    channelId: null,
    customerEntityId: null,
    customerSnapshot: null,
    billingAddressSnapshot: null,
    shippingAddressSnapshot: null,
    shippingMethodId: null,
    shippingMethodCode: null,
    shippingMethodSnapshot: null,
    paymentMethodId: null,
    paymentMethodCode: null,
    paymentMethodSnapshot: null,
    placedAt: null,
    createdAt: null,
    updatedAt: null,
    taxStrategyKey: null,
    taxInfo: null,
    taxStatus: null,
    taxCalculatedAt: null,
    taxTransactionRef: null,
    paidTotalAmount: '0',
    refundedTotalAmount: '0',
    deletedAt: null,
    ...overrides,
  }
}

const calculationResult = {
  lines: [],
  totals: {
    subtotalNetAmount: 100,
    subtotalGrossAmount: 123,
    discountTotalAmount: 0,
    taxTotalAmount: 23,
    shippingNetAmount: 0,
    shippingGrossAmount: 0,
    surchargeTotalAmount: 0,
    grandTotalNetAmount: 100,
    grandTotalGrossAmount: 123,
  },
  metadata: {
    tax: {
      providerKey: 'manual',
      status: 'success',
      calculatedAt: CALCULATED_AT,
      transaction: { reference: 'tax-tx-1' },
    },
  },
}

function makeEm(entityClass: unknown, document: unknown | null) {
  const em: any = {
    findOne: jest.fn(async (requested: unknown) => (requested === entityClass ? document : null)),
    find: jest.fn(async () => []),
    flush: jest.fn(async () => {}),
    begin: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    fork: function () {
      return this
    },
  }
  return em
}

function makeCtx(em: unknown) {
  const calculateDocumentTotals = jest.fn(async () => calculationResult)
  const container = createContainer({ injectionMode: InjectionMode.CLASSIC })
  container.register({
    em: asValue(em),
    dataEngine: asValue({ markOrmEntityChange: jest.fn() }),
    salesCalculationService: asValue({ calculateDocumentTotals }),
  })
  return {
    ctx: {
      container,
      auth: { tenantId: TENANT_ID, orgId: ORG_ID, sub: 'user-1' },
      selectedOrganizationId: ORG_ID,
      organizationScope: null,
      organizationIds: null,
      request: null,
    },
    calculateDocumentTotals,
  }
}

describe('sales.documents.recalculate_tax — route input contract', () => {
  beforeAll(async () => {
    commandRegistry.clear?.()
    await import('../documents')
  })

  beforeEach(() => {
    jest.mocked(findOneWithDecryption).mockClear()
  })

  function handler() {
    const found = commandRegistry.get('sales.documents.recalculate_tax')
    expect(found).toBeTruthy()
    return found!
  }

  it('recalculates an order from the payload the route sends', async () => {
    const order = makeDocument(ORDER_ID)
    const { ctx, calculateDocumentTotals } = makeCtx(makeEm(SalesOrder, order))

    // The exact object POST /api/sales/documents/recalculate-tax passes as input.
    const result = await handler().execute({ documentId: ORDER_ID, documentKind: 'order' }, ctx as any)

    expect(calculateDocumentTotals).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      documentId: ORDER_ID,
      documentKind: 'order',
      taxStatus: 'success',
      taxCalculatedAt: CALCULATED_AT,
    })
    expect(order.taxTotalAmount).toBe('23')
    expect(order.taxTransactionRef).toBe('tax-tx-1')
  })

  it('recalculates a quote from the payload the route sends', async () => {
    const quote = makeDocument(QUOTE_ID)
    const { ctx, calculateDocumentTotals } = makeCtx(makeEm(SalesQuote, quote))

    const result = await handler().execute({ documentId: QUOTE_ID, documentKind: 'quote' }, ctx as any)

    expect(calculateDocumentTotals).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      documentId: QUOTE_ID,
      documentKind: 'quote',
      taxStatus: 'success',
      taxCalculatedAt: CALCULATED_AT,
    })
  })

  it('looks the document up instead of rejecting the payload as invalid', async () => {
    const { ctx } = makeCtx(makeEm(SalesOrder, null))

    // A wrapper mismatch surfaced here as a ZodError on documentId/documentKind
    // rather than the 404 a genuinely missing document earns.
    const error = await handler()
      .execute({ documentId: ORDER_ID, documentKind: 'order' }, ctx as any)
      .then(() => null, (thrown: unknown) => thrown)

    expect(isCrudHttpError(error)).toBe(true)
    expect((error as { status: number }).status).toBe(404)

    const lookups = jest.mocked(findOneWithDecryption).mock.calls
    expect(lookups).toHaveLength(1)
    expect(lookups[0][1]).toBe(SalesOrder)
    expect(lookups[0][2]).toMatchObject({ id: ORDER_ID, deletedAt: null })
  })

  it('captures the undo snapshot in prepare from the same payload', async () => {
    const order = makeDocument(ORDER_ID)
    const { ctx } = makeCtx(makeEm(SalesOrder, order))

    // Reading the wrapper made prepare bail out before loading anything, which
    // left the operation with no snapshot to undo.
    const snapshots = await handler().prepare!({ documentId: ORDER_ID, documentKind: 'order' }, ctx as any)

    expect(snapshots).toHaveProperty('before')
    expect(jest.mocked(findOneWithDecryption).mock.calls.length).toBeGreaterThan(0)
  })
})
