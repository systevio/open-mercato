import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { hasAllFeatures } from '@open-mercato/shared/lib/auth/featureMatch'
import { DocumentTemplate } from '../data/entities'
import {
  documentTemplateContextSlotsSchema,
  type DocumentTemplateFillSlotInput,
} from '../data/validators'
import { getEntityRegistryEntry, getEntityTokenFieldNames } from './entityRegistry'
import { isDocumentEntityRegistryModuleEnabled } from './entityRegistryAvailability.server'
import { verifyEntityRegistrySelections } from './entityRegistry.server'
import { materializeDocumentHtml, type MaterializedDocumentHtml } from './collabMaterializer'
import { renderTemplateTokens, type TemplateRenderResult } from './templateFill'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'
import {
  canonicalizeTemplatePreviewInput,
  computeTemplatePreviewDigest,
  type CanonicalTemplatePreview,
} from './templatePreviewDigest'

export type PrepareTemplateRenderInput = {
  request: Request
  template: DocumentTemplate
  title: string
  locale: string
  effectiveDate: string
  templateUpdatedAt: string
  slots: DocumentTemplateFillSlotInput[]
  userFeatures: readonly string[]
  expectedDigest?: string | null
  rejectUnresolved?: boolean
  displayProfile?: DisplayProfile | null
}

export type PreparedTemplateRender = {
  canonical: CanonicalTemplatePreview
  /**
   * Authoritative registry snapshots in submitted slot order. Callers that
   * persist entity links must use these records, never the submitted labels,
   * hrefs, or token values.
   */
  verifiedSlots: DocumentTemplateFillSlotInput[]
  previewDigest: string
  render: TemplateRenderResult
  content: MaterializedDocumentHtml
}

export function dedupeTemplateLinkSlots<T extends Pick<DocumentTemplateFillSlotInput, 'entityType' | 'entityId'>>(
  slots: readonly T[],
): T[] {
  return Array.from(
    new Map(slots.map((slot) => [`${slot.entityType}:${slot.entityId}`, slot])).values(),
  )
}

export function clearOmittedOptionalSlotTokens(
  bodyHtml: string,
  contextSlots: DocumentTemplate['contextSlots'],
  submittedSlots: readonly Pick<DocumentTemplateFillSlotInput, 'slot'>[],
): string {
  const submitted = new Set(submittedSlots.map((slot) => slot.slot))
  const omittedOptional = new Set(
    documentTemplateContextSlotsSchema
      .parse(contextSlots ?? [])
      .filter((slot) => !slot.required && !submitted.has(slot.slot))
      .map((slot) => slot.slot),
  )
  if (omittedOptional.size === 0) return bodyHtml

  return bodyHtml.replace(
    /{{\s*([a-z][a-zA-Z0-9]*)\.[^{}]+?\s*}}/g,
    (token, slot: string) => omittedOptional.has(slot) ? '' : token,
  )
}

const LEGACY_BUILT_IN_MONEY_MARKUP: Record<string, readonly [string, string]> = {
  'deal-summary': [
    '<tr><td>Value</td><td>{{deal.value}} {{deal.valueCurrency}}</td></tr>',
    '<tr><td>Value</td><td>{{deal.formattedValue}}</td></tr>',
  ],
  'deal-proposal': [
    '<p>Value: {{deal.value}} {{deal.valueCurrency}}</p>',
    '<p>Value: {{deal.formattedValue}}</p>',
  ],
  'quote-cover-letter': [
    '<p>Total: {{quote.total}} {{quote.currency}}</p>',
    '<p>Total: {{quote.formattedTotal}}</p>',
  ],
  'order-handoff': [
    '<p>Total: {{order.total}} {{order.currency}}</p>',
    '<p>Total: {{order.formattedTotal}}</p>',
  ],
}

export function materializeBuiltInMoneyTokens(
  seedKey: string | null | undefined,
  bodyHtml: string,
): string {
  const replacement = seedKey ? LEGACY_BUILT_IN_MONEY_MARKUP[seedKey] : undefined
  if (!replacement) return bodyHtml
  return bodyHtml.replace(replacement[0], replacement[1])
}

function validateTemplateRevision(template: DocumentTemplate, submitted: string): void {
  const revision = new Date(submitted)
  if (Number.isNaN(revision.getTime()) || revision.toISOString() !== template.updatedAt.toISOString()) {
    throw new CrudHttpError(409, { error: 'documents.templates.staleTemplate' })
  }
}

function validateTemplateSlots(
  template: DocumentTemplate,
  slots: DocumentTemplateFillSlotInput[],
  features: readonly string[],
): void {
  const expectedSlots = documentTemplateContextSlotsSchema.parse(template.contextSlots ?? [])
  const submittedByName = new Map(slots.map((slot) => [slot.slot, slot]))
  if (submittedByName.size !== slots.length) {
    throw new CrudHttpError(400, { error: 'documents.templates.duplicateSlot' })
  }
  for (const expected of expectedSlots) {
    const expectedEntry = getEntityRegistryEntry(expected.entityType)
    if (!expectedEntry) {
      throw new CrudHttpError(400, { error: 'documents.links.invalidEntityType' })
    }
    if (
      expected.required
      && (
        !isDocumentEntityRegistryModuleEnabled(expectedEntry)
        || !hasAllFeatures([expectedEntry.requiredFeature], Array.from(features))
      )
    ) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }
    const submitted = submittedByName.get(expected.slot)
    if (!submitted) {
      if (expected.required) {
        throw new CrudHttpError(400, { error: 'documents.templates.requiredSlotMissing' })
      }
      continue
    }
    if (submitted.entityType !== expected.entityType) {
      throw new CrudHttpError(400, { error: 'documents.templates.slotTypeMismatch' })
    }
  }
  for (const submitted of slots) {
    if (!expectedSlots.some((slot) => slot.slot === submitted.slot)) {
      throw new CrudHttpError(400, { error: 'documents.templates.unknownSlot' })
    }
    const registryEntry = getEntityRegistryEntry(submitted.entityType)
    if (
      !registryEntry
      || !isDocumentEntityRegistryModuleEnabled(registryEntry)
      || !hasAllFeatures([registryEntry.requiredFeature], Array.from(features))
    ) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }
    const allowedFields = getEntityTokenFieldNames(submitted.entityType)
    for (const field of Object.keys(submitted.values)) {
      if (!allowedFields.has(field)) {
        throw new CrudHttpError(400, { error: 'documents.templates.invalidTokenField' })
      }
    }
  }
}

export async function prepareTemplateRender(
  input: PrepareTemplateRenderInput,
): Promise<PreparedTemplateRender> {
  validateTemplateRevision(input.template, input.templateUpdatedAt)
  validateTemplateSlots(input.template, input.slots, input.userFeatures)
  const verifiedSelections = await verifyEntityRegistrySelections(
    input.request,
    input.slots.map((slot) => ({
      entityType: slot.entityType,
      entityId: slot.entityId,
      label: slot.label,
      href: slot.href,
    })),
  )

  const verifiedSlots = input.slots.map((slot) => {
    const verified = verifiedSelections.get(`${slot.entityType}:${slot.entityId}`)
    if (!verified) throw new CrudHttpError(400, { error: 'documents.links.targetMismatch' })
    return {
      ...slot,
      label: verified.label,
      href: verified.href,
      values: verified.values,
    }
  })

  const digestInput = {
    templateId: input.template.id,
    templateUpdatedAt: input.templateUpdatedAt,
    title: input.title,
    locale: input.locale,
    effectiveDate: input.effectiveDate,
    slots: verifiedSlots,
  }
  const canonical = canonicalizeTemplatePreviewInput(digestInput)
  const previewDigest = computeTemplatePreviewDigest(digestInput)
  if (input.expectedDigest && previewDigest !== input.expectedDigest) {
    throw new CrudHttpError(409, { error: 'documents.templates.previewChanged' })
  }

  const tokenRender = renderTemplateTokens(
    clearOmittedOptionalSlotTokens(
      materializeBuiltInMoneyTokens(input.template.seedKey, input.template.bodyHtml),
      input.template.contextSlots,
      canonical.slots,
    ),
    canonical.slots.map((slot) => ({
      slot: slot.slot,
      entityType: slot.entityType,
      entityId: slot.entityId,
      label: slot.label,
      href: slot.href,
      values: slot.values,
    })),
    {
      locale: canonical.locale,
      now: new Date(canonical.effectiveDate),
      displayProfile: input.displayProfile,
    },
  )
  if (input.rejectUnresolved && tokenRender.unresolvedTokens.length > 0) {
    throw new CrudHttpError(400, {
      error: 'documents.templates.unresolvedTokens',
      unresolvedTokens: tokenRender.unresolvedTokens,
    })
  }

  const content = materializeDocumentHtml(tokenRender.html)
  if (!content) {
    throw new CrudHttpError(400, { error: 'documents.templates.invalidContent' })
  }
  const render = { ...tokenRender, html: content.html }

  return { canonical, verifiedSlots, previewDigest, render, content }
}
