import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const commandsDir = join(__dirname, '..')

function read(file: string): string {
  return readFileSync(join(commandsDir, file), 'utf8')
}

/**
 * The tax stage only runs when the calculation context carries a tax block. A
 * recalculation site that builds its context by hand would silently skip it and
 * store no provenance, so every site must go through one of the two helpers
 * that assemble the block. This scan is the guard: it is cheap, it cannot be
 * satisfied by accident, and it fails the moment a nineteenth site appears.
 */
describe('tax context coverage across recalculation sites', () => {
  const documents = read('documents.ts')
  const returns = read('returns.ts')

  it('routes every documents.ts recalculation through the tax-aware helper', () => {
    const totalsCalls = documents.match(/calculateDocumentTotals\(\{/g) ?? []
    expect(totalsCalls.length).toBe(14)

    const contexts = documents.match(/context:\s*calculationContext/g) ?? []
    expect(contexts.length).toBe(14)

    const helperCalls = documents.match(/await resolveDocumentCalculationContext\(\{/g) ?? []
    expect(helperCalls.length).toBe(12)
  })

  it('routes every returns.ts recalculation through the tax-aware helper', () => {
    const totalsCalls = returns.match(/calculateDocumentTotals\(\{/g) ?? []
    expect(totalsCalls.length).toBe(4)

    const contexts = returns.match(/context:\s*await buildCalculationContext\(em, order, lineSnapshots\)/g) ?? []
    expect(contexts.length).toBe(4)
  })

  it('leaves no hand-built calculation context behind in either file', () => {
    // A site that inlines `metadata: {` next to a `calculateDocumentTotals`
    // call would bypass the helper; only the two helpers may build one.
    expect(documents.match(/const calculationContext = buildCalculationContext\(\{/g)).toBeNull()
    expect(returns.match(/buildCalculationContext\(order\)/g)).toBeNull()
  })

  it('keeps the tax block required on the documents.ts context builder', () => {
    expect(documents).toContain('tax: TaxDocumentContext;')
  })

  it('assembles the tax context before the write transaction opens', () => {
    // Both helpers are the only callers of resolveTaxDocumentContext, and both
    // run before their command's withAtomicFlush block.
    const occurrences = (documents.match(/resolveTaxDocumentContext\(\{/g) ?? []).length
    expect(occurrences).toBe(1)
    expect((returns.match(/resolveTaxDocumentContext\(\{/g) ?? []).length).toBe(1)
  })
})
