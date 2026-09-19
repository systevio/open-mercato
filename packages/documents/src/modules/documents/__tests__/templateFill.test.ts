import { fillTemplateTokens, renderTemplateTokens, type TemplateFillSlot } from '../lib/templateFill'
import { US_DISPLAY_TEMPLATE } from '@open-mercato/shared/lib/display/templates'

const DEAL_ID = '11111111-1111-4111-8111-111111111111'

describe('fillTemplateTokens', () => {
  it('escapes substituted field values', () => {
    const html = '<p>Hello {{customer.name}} at {{customer.email}}</p>'
    const slots: TemplateFillSlot[] = [
      {
        slot: 'customer',
        entityType: 'customer-person',
        rawItem: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Ada & <Grace> "Q" \'L\'',
          email: 'ada@example.test',
        },
      },
    ]

    expect(fillTemplateTokens(html, slots)).toBe(
      '<p>Hello Ada &amp; &lt;Grace&gt; &quot;Q&quot; &#39;L&#39; at ada@example.test</p>',
    )
  })

  it('inserts values containing replacement dollar-patterns literally', () => {
    const html = '<p>HEAD</p><p>Hello {{customer.name}} and {{customer.email}}</p>'
    const slots: TemplateFillSlot[] = [
      {
        slot: 'customer',
        entityType: 'customer-person',
        rawItem: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'x$`y',
          email: "a$'b$&c$$d",
        },
      },
    ]

    expect(fillTemplateTokens(html, slots)).toBe(
      '<p>HEAD</p><p>Hello x$`y and a$&#39;b$&amp;c$$d</p>',
    )
  })

  it('substitutes entity chips with escaped attributes and label text', () => {
    const html = '<p>Deal: {{deal.chip}}</p>'
    const slots: TemplateFillSlot[] = [
      {
        slot: 'deal',
        entityType: 'deal',
        rawItem: {
          id: DEAL_ID,
          title: 'Acme & Sons <Deal>',
          status: 'open',
        },
      },
    ]

    const filled = fillTemplateTokens(html, slots)

    expect(filled).toContain('data-entity-ref')
    expect(filled).toContain('data-entity-type="deal"')
    expect(filled).toContain(`data-entity-id="${DEAL_ID}"`)
    expect(filled).toContain(`data-href="/backend/customers/deals/${DEAL_ID}"`)
    expect(filled).toContain('Acme &amp; Sons &lt;Deal&gt;')
  })

  it('strips unresolved tokens and collapses doubled spaces', () => {
    const html = '<p>Product {{product.sku}}  {{product.chip}} ready</p>'
    const slots: TemplateFillSlot[] = [
      {
        slot: 'product',
        entityType: 'product',
        rawItem: null,
      },
    ]

    expect(fillTemplateTokens(html, slots)).toBe('<p>Product ready</p>')
  })

  it('replaces date tokens with the localized date', () => {
    const html = '<p>{{date}}</p>'
    const now = new Date('2026-01-02T12:00:00.000Z')

    expect(fillTemplateTokens(html, [], { locale: 'en-US', now })).toBe('<p>1/2/2026</p>')
  })

  it('uses UTC for deterministic effective-date rendering across hosts', () => {
    const now = new Date('2026-01-02T00:30:00+14:00')

    expect(fillTemplateTokens('<p>{{date}}</p>', [], { locale: 'en-US', now })).toBe('<p>1/1/2026</p>')
  })

  it('materializes formatted money with the owning organization display profile', () => {
    const profile = {
      ...US_DISPLAY_TEMPLATE,
      currencyDisplay: 'symbol_and_code' as const,
      negativeStyle: 'parentheses' as const,
    }
    const slots: TemplateFillSlot[] = [{
      slot: 'quote',
      entityType: 'quote',
      rawItem: {
        id: DEAL_ID,
        quoteNumber: 'Q-100',
        grandTotalGross: -1234.5,
        currencyCode: 'USD',
      },
    }]

    expect(fillTemplateTokens(
      '<p>{{quote.formattedTotal}}</p>',
      slots,
      { locale: 'pl-PL', displayProfile: profile },
    )).toBe('<p>($1,234.50 USD)</p>')
  })

  it('preserves explicit foreign denomination instead of applying profile currency', () => {
    const slots: TemplateFillSlot[] = [{
      slot: 'quote',
      entityType: 'quote',
      rawItem: {
        id: DEAL_ID,
        quoteNumber: 'Q-101',
        grandTotalGross: 1234.5,
        currencyCode: 'PLN',
      },
    }]

    const rendered = fillTemplateTokens(
      '<p>{{quote.formattedTotal}}</p><p>{{quote.total}} {{quote.currency}}</p>',
      slots,
      { locale: 'en-US', displayProfile: US_DISPLAY_TEMPLATE },
    )

    expect(rendered).toMatch(/^<p>PLN\s1,234\.50<\/p><p>1234\.5 PLN<\/p>$/)
    expect(rendered).not.toContain('$')
  })

  it('does not infer a denomination for formatted money when source currency is missing', () => {
    const result = renderTemplateTokens(
      '<p>{{quote.formattedTotal}}</p>',
      [{
        slot: 'quote',
        entityType: 'quote',
        rawItem: { id: DEAL_ID, quoteNumber: 'Q-102', grandTotalGross: 1234.5 },
      }],
      { locale: 'en-US', displayProfile: US_DISPLAY_TEMPLATE },
    )

    expect(result.html).toBe('<p></p>')
    expect(result.unresolvedTokens).toEqual(['quote.formattedTotal'])
  })

  it.each([
    '<p>{{customer.name</p>',
    '<p>customer.name}}</p>',
    '<p>{{}}</p>',
    '<p>{{customer.{{name}}</p>',
  ])('reports malformed token syntax and never returns it as renderable HTML: %s', (bodyHtml) => {
    const result = renderTemplateTokens(bodyHtml, [])
    expect(result.unresolvedTokens).toContain('invalid-token-syntax')
    expect(result.html).toBe('')
  })
})
