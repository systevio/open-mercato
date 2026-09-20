import { selectionForPreset } from '../backend/documents/components/templateUi'
import { renderTemplateTokens } from '../lib/templateFill'
import { clearOmittedOptionalSlotTokens, materializeBuiltInMoneyTokens } from '../lib/templateInstantiation'
import { DEFAULT_DOCUMENT_TEMPLATES } from '../lib/templateSeeds'
import { resolveRelatedDocumentContext } from '../widgets/injection/related-documents/context'

const PRODUCT_ID = '22222222-2222-4222-8222-222222222222'

describe('contextual template presets', () => {
  it('hydrates available host token values and omits unavailable values', () => {
    const context = resolveRelatedDocumentContext(
      { resourceKind: 'catalog.product', resourceId: PRODUCT_ID, operation: 'update' },
      { id: PRODUCT_ID, title: 'Conference table', sku: 'TABLE-01' },
    )

    expect(context).toMatchObject({
      entityType: 'product',
      entityId: PRODUCT_ID,
      label: 'Conference table',
      values: { title: 'Conference table', sku: 'TABLE-01' },
    })

    const selection = selectionForPreset(context!)
    expect(selection?.values).toEqual({ title: 'Conference table', sku: 'TABLE-01' })
    expect(selection?.values).not.toHaveProperty('subtitle')
  })

  it('accepts an edit host with an explicit id when the generic form operation is misclassified as create', () => {
    const context = resolveRelatedDocumentContext(
      { resourceKind: 'catalog.product', resourceId: PRODUCT_ID, operation: 'create' },
      { title: 'Conference table', sku: 'TABLE-01' },
    )

    expect(context).toMatchObject({
      entityType: 'product',
      entityId: PRODUCT_ID,
      label: 'Conference table',
    })
  })

  it('never turns unavailable non-primary fields into resolved empty values', () => {
    const selection = selectionForPreset({
      entityType: 'quote',
      entityId: PRODUCT_ID,
      label: 'Q-2026-17',
      values: { number: 'Q-2026-17' },
    })

    expect(selection?.values).toEqual({ number: 'Q-2026-17' })
    expect(selection?.values).not.toHaveProperty('status')
    expect(selection?.values).not.toHaveProperty('total')
    expect(selection?.values).not.toHaveProperty('currency')
  })

  it('uses the localized fallback and drops UUID-bearing preset values', () => {
    const selection = selectionForPreset({
      entityType: 'product',
      entityId: PRODUCT_ID,
      label: `Customer ${PRODUCT_ID}`,
      fallbackLabel: 'Current record',
      values: { title: `Customer ${PRODUCT_ID}`, sku: `SKU ${PRODUCT_ID}` },
    })

    expect(selection).toMatchObject({ label: 'Current record', values: { title: 'Current record' } })
    expect(JSON.stringify(selection)).not.toContain(`Customer ${PRODUCT_ID}`)
  })

  it('suppresses create-form and invalid host contexts', () => {
    expect(resolveRelatedDocumentContext({ resourceKind: 'catalog.product', operation: 'create' }, {})).toBeNull()
    expect(resolveRelatedDocumentContext({ resourceKind: 'catalog.product', operation: 'create' }, { id: PRODUCT_ID })).toBeNull()
    expect(resolveRelatedDocumentContext({ resourceKind: 'customers.person' }, {})).toBeNull()
  })

  it('renders omitted optional preset context as blank instead of blocking preview', () => {
    for (const template of DEFAULT_DOCUMENT_TEMPLATES) {
      const bodyHtml = clearOmittedOptionalSlotTokens(
        template.bodyHtml,
        template.contextSlots,
        [],
      )
      const unresolved = renderTemplateTokens(bodyHtml, []).unresolvedTokens
      const requiredSlots = new Set(
        template.contextSlots.filter((slot) => slot.required).map((slot) => slot.slot),
      )

      expect(
        unresolved.every((token) => requiredSlots.has(token.split('.')[0] ?? '')),
      ).toBe(true)
    }

    const meetingNotes = DEFAULT_DOCUMENT_TEMPLATES.find(
      (template) => template.seedKey === 'meeting-notes',
    )!
    expect(renderTemplateTokens(
      clearOmittedOptionalSlotTokens(meetingNotes.bodyHtml, meetingNotes.contextSlots, []),
      [],
    ).unresolvedTokens).toEqual([])
  })

  it('uses formatted money tokens in human templates while retaining raw token fields', () => {
    const moneyTemplates = DEFAULT_DOCUMENT_TEMPLATES.filter((template) => (
      ['deal-summary', 'deal-proposal', 'quote-cover-letter', 'order-handoff'].includes(template.seedKey)
    ))

    expect(moneyTemplates).toHaveLength(4)
    for (const template of moneyTemplates) {
      expect(template.bodyHtml).toMatch(/\.formatted(?:Value|Total)}}/)
      expect(template.bodyHtml).not.toMatch(/}}\s+{{(?:deal\.valueCurrency|quote\.currency|order\.currency)}}/)
    }
  })

  it('upgrades only the exact legacy money markup of managed built-in templates at render time', () => {
    expect(materializeBuiltInMoneyTokens(
      'quote-cover-letter',
      '<p>Total: {{quote.total}} {{quote.currency}}</p>',
    )).toBe('<p>Total: {{quote.formattedTotal}}</p>')
    expect(materializeBuiltInMoneyTokens(
      'quote-cover-letter',
      '<p>Custom total: {{quote.total}} {{quote.currency}}</p>',
    )).toBe('<p>Custom total: {{quote.total}} {{quote.currency}}</p>')
    expect(materializeBuiltInMoneyTokens(
      null,
      '<p>Total: {{quote.total}} {{quote.currency}}</p>',
    )).toBe('<p>Total: {{quote.total}} {{quote.currency}}</p>')
  })
})
