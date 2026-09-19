/** @jest-environment node */

/**
 * A line write re-runs the tax stage on its own.
 *
 * The line dialog no longer asks for a tax class when an external provider is selected, which is
 * only safe if adding, editing or deleting a line already recalculates the document *through the
 * provider* — otherwise a US order would sit at the built in fallback's figures until somebody
 * pressed "Recalculate tax".
 *
 * The stage runs off the calculation context: `calculateDocumentTotals` dispatches it when the
 * context carries a `tax` block naming the organization's selected provider
 * (`documents.tax-context-coverage.test.ts` pins that every recalculation site builds one). This
 * suite closes the loop from the other end — it drives each of the four line commands end to end
 * and reads the context they actually handed the calculation service, so a line write that
 * silently stopped resolving the selection would fail here rather than in production.
 */

import { createContainer, asValue, InjectionMode } from 'awilix'
import { commandRegistry } from '@open-mercato/shared/lib/commands/registry'
import { SalesOrder, SalesQuote } from '../../data/entities'

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({
    locale: 'en',
    dict: {},
    t: (key: string, fallback?: string) => fallback ?? key,
    translate: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

jest.mock('@open-mercato/shared/lib/crud/cache', () => ({
  invalidateCrudCache: jest.fn(),
}))

const ORG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const QUOTE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const LINE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
// A document must keep at least one line, so the delete cases need a second one to remove.
const OTHER_LINE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

/** Stands in for any package-provided provider; the built in key is `table-rates`. */
const EXTERNAL_PROVIDER_KEY = 'test-external-tax'

type World = {
  order: Record<string, unknown>
  quote: Record<string, unknown>
  lines: Record<string, unknown>[]
  providerKey: string | null
}

function makeLine(id: string, lineNumber: number): Record<string, unknown> {
  return {
    id,
    lineNumber,
    kind: 'product',
    productId: null,
    productVariantId: null,
    name: `Line ${lineNumber}`,
    quantity: '2',
    quantityUnit: null,
    normalizedQuantity: '2',
    normalizedUnit: null,
    uomSnapshot: null,
    currencyCode: 'USD',
    unitPriceNet: '100',
    unitPriceGross: '100',
    discountAmount: '0',
    discountPercent: '0',
    taxRate: '0',
    taxAmount: null,
    totalNetAmount: '200',
    totalGrossAmount: '200',
    updatedAt: new Date('2026-09-19T09:00:00.000Z'),
  }
}

function setWorld(providerKey: string | null): World {
  const documentBase = {
    organizationId: ORG_ID,
    tenantId: TENANT_ID,
    deletedAt: null,
    currencyCode: 'USD',
    updatedAt: new Date('2026-09-19T09:00:00.000Z'),
  }
  const world: World = {
    order: { ...documentBase, id: ORDER_ID },
    quote: { ...documentBase, id: QUOTE_ID },
    lines: [makeLine(LINE_ID, 1), makeLine(OTHER_LINE_ID, 2)],
    providerKey,
  }
  ;(globalThis as { __taxStageWorld?: World }).__taxStageWorld = world
  return world
}

const world = () => (globalThis as { __taxStageWorld?: World }).__taxStageWorld as World

jest.mock('@open-mercato/shared/lib/encryption/find', () => ({
  findOneWithDecryption: jest.fn(async (_em: unknown, entityClass: unknown) => {
    const current = (globalThis as { __taxStageWorld?: World }).__taxStageWorld as World
    if (entityClass === SalesOrder) return current.order
    if (entityClass === SalesQuote) return current.quote
    return null
  }),
  findWithDecryption: jest.fn(async () => []),
}))

function makeEm() {
  const em: Record<string, unknown> = {
    fork: function (this: unknown) {
      return this
    },
    transactional: async (cb: (tx: unknown) => Promise<unknown>) => cb(em),
    // `withAtomicFlush` opens its own top-level transaction when the EM reports none is active.
    isInTransaction: () => false,
    begin: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    find: jest.fn(async (entityClass: unknown) => {
      const entityName = (entityClass as { name?: string })?.name ?? ''
      if (entityName === 'SalesOrderLine' || entityName === 'SalesQuoteLine') return world().lines
      return []
    }),
    // The only `findOne` the tax context needs is the settings row that carries the selection.
    findOne: jest.fn(async (entityClass: unknown) => {
      const entityName = (entityClass as { name?: string })?.name ?? ''
      if (entityName === 'SalesSettings') {
        return {
          taxProviderKey: world().providerKey,
          taxProviderSettings: null,
          taxProviderTimeoutMs: null,
          shipFromAddress: null,
        }
      }
      return null
    }),
    count: jest.fn(async () => 0),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    persist: jest.fn(),
    remove: jest.fn(),
    flush: jest.fn(async () => {}),
    getReference: jest.fn((_entity: unknown, id: string) => ({ id })),
    getConnection: () => ({ execute: jest.fn(async () => [{ value: 1 }]) }),
  }
  return em
}

type CalculationLine = Record<string, unknown>

/**
 * The tax block lives under `metadata.tax` — that is where `calculateDocumentTotals` looks for it
 * before dispatching the stage.
 */
type CalculationContext = {
  metadata?: {
    tax?: {
      selection?: { providerKey?: string }
      document?: { kind?: string; intent?: string; id?: string | null }
    }
  }
}

function makeCtx(em: unknown) {
  const contexts: CalculationContext[] = []
  const container = createContainer({ injectionMode: InjectionMode.CLASSIC })
  container.register({
    em: asValue(em),
    dataEngine: asValue({ markOrmEntityChange: jest.fn() }),
    salesCalculationService: asValue({
      // A pass-through stand-in for the real service: it records the context it was handed and
      // echoes each line back so the command can persist its results and run to completion.
      calculateDocumentTotals: jest.fn(
        async (params: { context?: CalculationContext; lines?: CalculationLine[] }) => {
          if (params?.context) contexts.push(params.context)
          return {
            totals: {},
            lines: (params.lines ?? []).map((line) => ({
              line,
              netAmount: 0,
              grossAmount: 0,
              taxAmount: 0,
              discountAmount: 0,
            })),
          }
        },
      ),
    }),
  })
  const ctx = {
    container,
    auth: { tenantId: TENANT_ID, orgId: ORG_ID, sub: 'user-1' },
    selectedOrganizationId: ORG_ID,
    organizationScope: null,
    organizationIds: null,
    request: new Request('https://example.test/api/sales/order-lines', { method: 'PUT' }),
  }
  return { ctx, contexts }
}

const orderLineBody = {
  id: LINE_ID,
  orderId: ORDER_ID,
  organizationId: ORG_ID,
  tenantId: TENANT_ID,
  currencyCode: 'USD',
  kind: 'product',
  quantity: 3,
  unitPriceNet: 100,
  unitPriceGross: 100,
  taxRate: 0,
}

const quoteLineBody = { ...orderLineBody, orderId: undefined, quoteId: QUOTE_ID }

async function runCommand(commandId: string, body: Record<string, unknown>) {
  const handler = commandRegistry.get(commandId)
  if (!handler) throw new Error(`[internal] ${commandId} is not registered`)
  const em = makeEm()
  const { ctx, contexts } = makeCtx(em)
  await handler.execute({ body } as never, ctx as never)
  return contexts
}

const LINE_WRITE_COMMANDS: Array<[string, string, Record<string, unknown>]> = [
  ['adding or editing an order line', 'sales.orders.lines.upsert', orderLineBody],
  ['deleting an order line', 'sales.orders.lines.delete', { id: LINE_ID, orderId: ORDER_ID }],
  ['adding or editing a quote line', 'sales.quotes.lines.upsert', quoteLineBody],
  ['deleting a quote line', 'sales.quotes.lines.delete', { id: LINE_ID, quoteId: QUOTE_ID }],
]

describe('tax stage after a line write', () => {
  beforeAll(async () => {
    commandRegistry.clear?.()
    await import('../documents')
  })

  afterEach(() => {
    delete (globalThis as { __taxStageWorld?: World }).__taxStageWorld
  })

  it.each(LINE_WRITE_COMMANDS)(
    'recalculates through the selected external provider when %s',
    async (_label, commandId, body) => {
      setWorld(EXTERNAL_PROVIDER_KEY)
      const contexts = await runCommand(commandId, body)

      expect(contexts.length).toBeGreaterThan(0)
      for (const context of contexts) {
        expect(context.metadata?.tax?.selection?.providerKey).toBe(EXTERNAL_PROVIDER_KEY)
        // An order or a quote is an estimate, so the stage recomputes rather than recording a
        // caller's figures — which is what makes the "no Recalculate tax click" promise hold.
        expect(context.metadata?.tax?.document?.intent).toBe('estimate')
      }
    },
  )

  it.each(LINE_WRITE_COMMANDS)(
    'falls back to the built in provider with no selection when %s',
    async (_label, commandId, body) => {
      setWorld(null)
      const contexts = await runCommand(commandId, body)

      expect(contexts.length).toBeGreaterThan(0)
      for (const context of contexts) {
        expect(context.metadata?.tax?.selection?.providerKey).toBe('table-rates')
      }
    },
  )
})
