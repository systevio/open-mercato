const REVIEWED_FILE_EXCEPTIONS = new Set([
  'packages/shared/src/lib/display/money.ts',
  'packages/ui/src/utils/format.ts',
  'packages/core/src/modules/customers/components/detail/utils.ts',
  'packages/core/src/modules/sales/components/PriceWithCurrency.tsx',
  'packages/core/src/modules/sales/components/documents/SalesDocumentsTable.tsx',
  'packages/core/src/modules/sales/components/documents/PaymentsSection.tsx',
  'packages/core/src/modules/sales/components/documents/lineItemUtils.ts',
  'packages/core/src/modules/sales/backend/sales/documents/[id]/page.tsx',
  'packages/core/src/modules/customers/backend/customers/deals/pipeline/components/QuickDealDialog.tsx',
  'packages/core/src/modules/workflows/frontend/checkout-demo/page.tsx',
])

function normalizedFilename(filename) {
  return filename.replaceAll('\\', '/').replace(/^.*?(?=packages\/|apps\/)/, '')
}

function isGeneratedOrDataContract(filename) {
  return /(?:__tests__|__integration__|\/seed\/|\/fixtures\/|\.generated\.)/.test(filename) ||
    /(?:Seeds|seeds)\.[jt]sx?$/.test(filename) ||
    filename.startsWith('packages/enterprise/')
}

function isIntlNumberFormat(node) {
  return node.callee?.type === 'MemberExpression' &&
    node.callee.object?.type === 'Identifier' && node.callee.object.name === 'Intl' &&
    node.callee.property?.type === 'Identifier' && node.callee.property.name === 'NumberFormat'
}

function hasCurrencyStyle(node) {
  return node.arguments.some((argument) => argument.type === 'ObjectExpression' &&
    argument.properties.some((property) => property.type === 'Property' &&
      property.key?.type === 'Identifier' && property.key.name === 'style' &&
      property.value?.type === 'Literal' && property.value.value === 'currency'))
}

function isCurrencyFallback(node, sourceCode) {
  if (!['||', '??'].includes(node.operator)) return false
  if (node.right?.type !== 'Literal' || typeof node.right.value !== 'string') return false
  if (!/^[A-Z]{3}$/.test(node.right.value)) return false
  return /currenc/i.test(sourceCode.getText(node.left))
}

export const noBespokeMoneyFormat = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require shared profile-aware money helpers and reviewed currency defaults',
    },
    messages: {
      bespokeFormatter: 'Use formatMoney/formatNumber with the active display profile instead of a bespoke Intl currency formatter.',
      literalFallback: 'Do not infer a display currency from a literal fallback. Use an explicit record currency or a validated pristine-create market default.',
    },
    schema: [],
  },
  create(context) {
    const filename = normalizedFilename(context.filename ?? context.getFilename())
    if (REVIEWED_FILE_EXCEPTIONS.has(filename) || isGeneratedOrDataContract(filename)) return {}
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    return {
      NewExpression(node) {
        if (isIntlNumberFormat(node) && hasCurrencyStyle(node)) {
          context.report({ node, messageId: 'bespokeFormatter' })
        }
      },
      LogicalExpression(node) {
        if (isCurrencyFallback(node, sourceCode)) {
          context.report({ node, messageId: 'literalFallback' })
        }
      },
    }
  },
}
