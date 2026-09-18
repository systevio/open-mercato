# Execution plan — market-display-profile

**Run:** 2026-09-18-market-display-profile
**Engine:** om-auto-create-pr-loop (invoked by `om-auto-implement-spec` → `om-auto-create-pr --loop`)
**Branch:** feat/market-display-profile
**Base branch:** develop
**Source spec:** `.ai/specs/2026-09-18-market-display-profile.md` (design-only spec PR #1, branch `spec/market-display-profile`)
**Spec PR:** https://github.com/systevio/open-mercato/pull/1

## Tasks

> Authoritative status table. `Status` is one of `todo` or `done`. On landing a Step, flip `Status` to `done` and fill the `Commit` column with the short SHA. The first row whose `Status` is not `done` is the resume point for `om-auto-continue-pr-loop`. Step ids and `Exec` cells are immutable once the plan is committed — per-Step commits touch only `Status` and `Commit`.

| Phase | Step | Title | Exec | Status | Commit |
|-------|------|-------|------|--------|--------|
| 1 | 1.1 | `markets` module skeleton: entity, validators, acl, di, index | dispatch:capable | todo | — |
| 1 | 1.2 | `market_display_profiles` migration and module snapshot | dispatch:standard | todo | — |
| 1 | 1.3 | Static subdivision table in `packages/shared/src/lib/location` | dispatch:cheap | todo | — |
| 1 | 1.4 | Pure display helper layer in `packages/shared/src/lib/display` | dispatch:capable | todo | — |
| 1 | 1.5 | `displayProfileResolver`: DI-cached resolver with fallback chain | dispatch:capable | todo | — |
| 1 | 1.6 | `MarketProfileProvider`, `useDisplayProfile`, root-layout mount, template sync | dispatch:capable | todo | — |
| 1 | 1.7 | Profile commands with undo, events, cache invalidation | dispatch:standard | todo | — |
| 1 | 1.8 | Profile CRUD API and read-only subdivisions route | dispatch:standard | todo | — |
| 1 | 1.9 | `markets/setup.ts`: seed templates, ACL sync, `seedDefaults` | dispatch:standard | todo | — |
| 1 | 1.10 | `en-US` overlay registration, module i18n, `i18n:check-sync` exemption | dispatch:standard | todo | — |
| 1 | 1.11 | Market display settings page with live preview and template picker | dispatch:capable | todo | — |
| 1 | 1.12 | Onboarding market selection step | dispatch:standard | todo | — |
| 1 | 1.13 | Customers address-format control becomes a pointer to the new page | dispatch:cheap | todo | — |
| 1 | 1.14 | Integration tests TC-MKT-001 and TC-MKT-002 | dispatch:standard | todo | — |
| 2 | 2.1 | `packages/ui` primitives and shells read the profile | dispatch:capable | todo | — |
| 2 | 2.2 | Address layer: layout descriptor in both editors | dispatch:capable | todo | — |
| 2 | 2.3 | Customers surfaces: dates, money, phone, exemption fields | dispatch:standard | todo | — |
| 2 | 2.4 | CRM calendar week start and hour cycle | dispatch:standard | todo | — |
| 2 | 2.5 | Tax display columns, `taxInfoSchema`, `TaxCalculator` seam | dispatch:capable | todo | — |
| 2 | 2.6 | Sales documents: money, dates, price presentation, tax line | dispatch:capable | todo | — |
| 2 | 2.7 | Public quote page and quote emails | dispatch:standard | todo | — |
| 2 | 2.8 | Catalog product forms, units and price-kind presentation | dispatch:standard | todo | — |
| 2 | 2.9 | Tax rates wording (`Tax rates` in place of `VAT classes`) | dispatch:cheap | todo | — |
| 2 | 2.10 | Sales channel and WMS warehouse address forms | dispatch:cheap | todo | — |
| 2 | 2.11 | Shipment wizard: pounds and inches at the input boundary | dispatch:standard | todo | — |
| 2 | 2.12 | Documents PDF paper size from the profile | dispatch:cheap | todo | — |
| 2 | 2.13 | CSV export dates, amounts and negative style | dispatch:cheap | todo | — |
| 2 | 2.14 | Portal profile page dates | dispatch:cheap | todo | — |
| 2 | 2.15 | Integration tests TC-MKT-003 to TC-MKT-009 | dispatch:capable | todo | — |

## Goal

Ship the organization-level market display profile from the spec so a US merchant can pick "United States" once and
have every surface on the hackathon happy path render in US conventions — while an organization that never picks a
market renders byte-identically to today.

## Scope

- **Phase 1** — the whole foundation: the `markets` core module (entity, migration, validators, ACL, DI, commands with
  undo, events, CRUD API, setup/seed, settings page, onboarding step), the pure helper layer in
  `packages/shared/src/lib/display/`, the static subdivision table, the cached resolver behind
  `displayProfileResolver`, and `MarketProfileProvider` / `useDisplayProfile()` mounted in the root layout. Nothing
  renders differently at the end of Phase 1.
- **Phase 2** — wave 1, the spec's hackathon happy path: `packages/ui` primitives and shells, the address layer in both
  `AddressEditor` twins, customers surfaces, the CRM calendar, the additive tax display columns plus the
  `TaxCalculator` seam and its stub, sales documents, the public quote page and quote emails, catalog product forms and
  price-kind presentation, tax wording, channel/warehouse address forms, the shipment wizard, PDF paper size, CSV
  exports and the portal profile page.
- Tests ship with the code: unit tests per helper/command/resolver, and integration tests `TC-MKT-001` … `TC-MKT-009`
  from the spec's testing strategy.

## Non-goals

- **Phase 3 of the spec (wave 2, the long tail) is out of scope for this run** — the ESLint rule
  `no-bespoke-display-format`, the remaining ~179 `toLocale*` / 55 `date-fns` / 30 money-formatter sites, and the
  collapse of the address twins behind a deprecated re-export. Spec decision D4 allows it to land later.
- No tax is computed, no address is validated against an authority, no currency is converted, no external service is
  called (spec D2, invariant 8).
- No new production dependency (D11). No new environment variable.
- No backfill of an `eu` profile row for existing organizations (A5); no change to `CATALOG_PRICE_DISPLAY_MODES` (A3);
  no rename of the `region` column (D8).
- `packages/enterprise/` is untouched.
- The spec document itself is **not** committed on this branch — it merges through its own design-only PR #1. It is
  materialized in the worktree (untracked) so executors can read it.

## Implementation Plan

Every Step is exactly one commit. Spec anchors below are section names in
`.ai/specs/2026-09-18-market-display-profile.md`; read that section before implementing.

### Phase 1: Entity, seed, resolver and helpers

**1.1 `markets` module skeleton: entity, validators, acl, di, index**
- New module `packages/core/src/modules/markets/` following the `currencies` module's shape (`index.ts`, `acl.ts`,
  `di.ts`, `data/entities.ts`, `data/validators.ts`).
- `MarketDisplayProfile` entity, table `market_display_profiles`, one row per organization, unique
  (`organization_id`, `tenant_id`), with `id`, `organization_id`, `tenant_id`, `created_at`, `updated_at`,
  `deleted_at`, `is_active` and every field of the spec's Data Models table.
- Zod create/update/delete schemas in `data/validators.ts`, including the `postal_code_pattern` guard (≤120 chars,
  anchored `^…$`, nested-quantifier rejection, compiled once inside try/catch) and the `time_zone` validation against
  `Intl.supportedValuesOf('timeZone')`.
- `acl.ts` features `markets.view` and `markets.manage`. `yarn generate` afterwards.
- Spec anchors: Data Models, Access control, Risks → ReDoS register entry.

**1.2 `market_display_profiles` migration and module snapshot**
- `yarn db:generate`, keep only the intended `markets` migration, review the SQL and the module's
  `migrations/.snapshot-open-mercato.json` (coding-agent exception in root `AGENTS.md` for unrelated output).
- Spec anchor: Migration and Compatibility → Database.

**1.3 Static subdivision table in `packages/shared/src/lib/location`**
- `subdivisions.ts` beside `countries.ts`: `Subdivision` type, `ISO_SUBDIVISIONS`, `getSubdivisions`,
  `isValidSubdivision`; 50 states + DC (`district`) + PR, GU, VI, AS, MP (`territory`).
- Unit tests: a state, a territory, lowercase input, an unknown country, the empty-country case.
- Spec anchor: Data Models → Static reference data; A7.

**1.4 Pure display helper layer in `packages/shared/src/lib/display`**
- `profile.ts` (`DisplayProfile`, `LEGACY_DISPLAY_DEFAULTS` frozen, `withProfile`), `money.ts`, `datetime.ts`,
  `address.ts`, `phone.ts`, `units.ts`, `paper.ts` with exactly the signatures in the spec — profile always the last,
  optional argument. No domain imports, no `process.env`, no React.
- `date-fns-tz` applies `time_zone`; `formatLength` feet/inches rounding; `formatAddress` US layout with country
  suppression; `convertUnit` static factor table returning `null` for unknown pairs; `resolvePriceLabelKey`.
- Unit tests per helper against the US profile, the EU profile and no profile, including the midnight-crossing case.
- Spec anchors: Shared formatting layer, Price presentation, Testing Strategy.

**1.5 `displayProfileResolver`: DI-cached resolver with fallback chain**
- `markets/lib/resolve-display-profile.ts`, registered in `markets/di.ts` under `displayProfileResolver`.
- Read-through DI cache, key `markets:display-profile:<tenantId>:<organizationId>`, tags `tenant:<id>`, `org:<id>`,
  `markets:display-profile`, TTL 300s. Fallback order: row → env pins → `Intl` defaults. Fail-safe: log via
  `createLogger`, `reportError`, return `null`.
- Unit tests: row present, row absent with pins, row absent bare, cache hit/miss, resolver token absent.
- Spec anchors: Module boundaries, A4, Risks → Cascading Failures.

**1.6 `MarketProfileProvider`, `useDisplayProfile`, root-layout mount, template sync**
- Re-export the helper layer from `packages/ui`; add `packages/ui/src/backend/markets/MarketProfileProvider.tsx`
  (context + one `useAppEvent` subscription for the `markets.market_display_profile.*` client broadcast) and
  `useDisplayProfile()`.
- Mount it in `apps/mercato/src/app/layout.tsx` beside `I18nProvider`, server-resolved profile passed as a prop; the
  layout stays a server component. Mirror into the create-app template (`yarn template:sync:fix`).
- Spec anchors: Frontend Architecture Contract (boundary map, `"use client"` ledger, budgets).

**1.7 Profile commands with undo, events, cache invalidation**
- `markets/commands/display-profile.ts`: create / update / delete following the `currencies` command pattern
  (`registerCommand`, `UndoPayload`, `makeCreateRedo`, `withAtomicFlush`, `emitCrudSideEffects`), each invalidating the
  cache tags in its after-success callback, outside `withAtomicFlush`.
- `markets/events.ts` via `createModuleEvents`: `.created` / `.updated` / `.deleted`, persistent,
  `clientBroadcast: true`. Unit tests for the undo payloads.
- Spec anchor: Commands and Events.

**1.8 Profile CRUD API and read-only subdivisions route**
- `GET` / `PUT` / `DELETE /api/markets/display-profile` via `makeCrudRoute` with
  `indexer: { entityType: 'markets:market_display_profile' }`, `metadata` with per-method `requireAuth` /
  `requireFeatures`, `openApi` export, optimistic-lock `409`, `{ item: null }` when no row exists.
- `GET /api/markets/subdivisions?countryCode=US` served from the static table with
  `Cache-Control: public, max-age=86400`, unpaginated and documented as such.
- Spec anchor: API Contracts.

**1.9 `markets/setup.ts`: seed templates, ACL sync, `seedDefaults`**
- The `us` and `eu` seed templates as constants (exact values from the Data Models table), ACL feature sync to roles
  (`markets.view` broadly, `markets.manage` to administrators), and the `seedDefaults` hook writing the row for a
  market chosen at onboarding. The `us` template creates new price kinds as `excluding-tax`.
- Spec anchors: Access control, Configuration, Price presentation.

**1.10 `en-US` overlay registration, module i18n, `i18n:check-sync` exemption**
- `registerLocales(['en-US'])` from the `markets` module registration; `markets/i18n/{en,pl,de,es,ko}.json` plus
  `markets/i18n/en-us.json`; the address/tax label keys the profile references.
- `scripts/i18n-check-sync.ts` treats a region-subtag overlay as an intentional subset and reports overlay keys absent
  from the base locale; add a test for the exemption.
- Spec anchor: Internationalization.

**1.11 Market display settings page with live preview and template picker**
- `markets/backend/settings/markets/page.tsx` (server, `requireFeatures: ['markets.manage']`) plus
  `components/MarketProfileForm.tsx`, `MarketProfileSections.tsx`, `MarketProfilePreview.tsx` — each under 300 LOC.
- `CrudForm` with `updateCrud`/`deleteCrud` (optimistic lock header derived from `initialValues.updatedAt`), six
  section groups, sticky live preview from current form values, template picker behind `useConfirmDialog()`, the
  `price_presentation` consequence stated beside its control, semantic DS tokens only, `LoadingMessage`/`ErrorMessage`.
- Spec anchors: UI/UX → Market display settings page; Frontend Architecture Contract.

**1.12 Onboarding market selection step**
- One select (`United States` / `European Union`) defaulted from the browser locale in
  `OnboardingPageClient.tsx`, carried through the onboarding payload into the `markets` `seedDefaults` hook via the
  existing best-effort provisioning step runner; skipping the step writes no row.
- Spec anchor: Configuration.

**1.13 Customers address-format control becomes a pointer to the new page**
- `customers/components/AddressFormatSettings.tsx`: keep the radio group only while no profile row exists, otherwise
  render an `<Alert variant="info">` pointing at the market display settings page.
- Spec anchor: UI/UX → Market display settings page (last paragraph).

**1.14 Integration tests TC-MKT-001 and TC-MKT-002**
- `packages/core/src/modules/markets/__integration__/`, self-contained fixtures per `.ai/qa/AGENTS.md`:
  `TC-MKT-001` (GET/PUT/DELETE, `409` lock path, `403` without `markets.manage`) and `TC-MKT-002` (subdivisions for
  `US` and for a country with no list).
- Spec anchor: Testing Strategy.

### Phase 2: Wave 1, the hackathon happy path

**2.1 `packages/ui` primitives and shells read the profile**
- `primitives/{date-format,date-picker,date-range-picker,time-picker,calendar}`,
  `backend/date-range/dateRanges.ts`, `backend/schedule/{ScheduleGrid,ScheduleAgenda,ScheduleCalendar}.tsx`,
  `backend/DataTable.tsx`, `backend/FilterOverlay.tsx`, `backend/detail/InlineEditors.tsx`, `utils/format.ts`.
- Week start via `weekStartsOn(profile)`, hour cycle via `hourCycle(profile)`, patterns from the profile;
  `formatDisplayDate` / `formatDisplayDateTime` become thin wrappers keeping their signatures and env-pin fallback;
  `formatCurrency` kept and `@deprecated` in favor of `formatMoney`.
- Spec anchors: Phase 2 step 1; invariant 6; Contract surfaces touched.

**2.2 Address layer: layout descriptor in both editors**
- `resolveAddressLayout(profile)` consumed by `packages/ui/src/backend/detail/{AddressEditor,AddressTiles,AddressesSection,addressFormat}.tsx`
  and `customers/components/{AddressEditor,AddressTiles}.tsx`, `customers/components/detail/AddressesSection.tsx`,
  `customers/utils/addressFormat.tsx` — no import-path change, no collapse (A1).
- State `<select>` when `subdivision_required`, ZIP validation against `postal_code_pattern` on blur and submit, hidden
  building/flat inputs, country default, `normalizePhoneInput` before phone validation, warning badge (never an error)
  for legacy rows that fail validation.
- Spec anchors: UI/UX → Address editor under the `us` layout; invariant 5.

**2.3 Customers surfaces: dates, money, phone, exemption fields**
- `customers/backend/customers/{people,companies,deals}/page.tsx`,
  `components/detail/{CompanyCard,DealDetailHeader,utils}.tsx`, `formConfig.tsx` phone handling, and the three
  exemption fields (`is_tax_exempt`, `exemption_certificate_number` encrypted, `entity_use_code`) on `CustomerEntity`
  surfaced on the company detail, with the `customers/encryption.ts` map entry and the migration.
- Spec anchors: Phase 2 step 3; Additive fields on existing entities; A2.

**2.4 CRM calendar week start and hour cycle**
- `customers/lib/calendar/range.ts`, `components/calendar/{MonthGrid,AgendaList}.tsx`,
  `api/interactions/conflicts/route.ts` read the profile instead of the Monday constant.

**2.5 Tax display columns, `taxInfoSchema`, `TaxCalculator` seam**
- Additive nullable columns: `tax_status`, `tax_calculated_at` on the four sales document entities; `tax_info` on
  `SalesInvoice`/`SalesCreditMemo`; `tax_strategy_key` on quote/invoice/credit-memo; `tax_code`, `is_taxable` on
  `CatalogProduct`/`CatalogProductVariant`. Migrations per module.
- `taxInfoSchema` / `taxBreakdownLineSchema` with `passthrough()`; `sales/lib/tax/types.ts`, `StubTaxCalculator`, DI
  token `taxCalculator`; one call site in the document totals path, used only under `single_price_plus_tax`.
- Lands before 2.6 so the rendering step has a tax line to render. Spec anchors: `TaxCalculator`; invariant 4.

**2.6 Sales documents: money, dates, price presentation, tax line**
- `sales/backend/sales/documents/[id]/page.tsx` and
  `sales/components/documents/{ItemsSection,LineItemDialog,ReturnsSection,SalesOrderDraftLines,SalesDocumentsTable,SalesDocumentForm,PaymentsSection,AddressesSection,lineItemUtils,PriceWithCurrency}.tsx`.
- Money and dates through the helpers; under `single_price_plus_tax` one unit price plus Subtotal / Shipping /
  Sales tax / Total, net always the displayed single price, `resolvePriceLabelKey` for the `(net)`/`(gross)` labels;
  US address print. Nothing changes under `dual_net_gross` or with no profile.

**2.7 Public quote page and quote emails**
- `sales/frontend/quote/[token]/page.tsx`; `sales/emails/{QuoteSentEmail,QuoteAcceptedAdminEmail}.tsx` render a
  server-built preformatted view model rather than formatting inside the template.

**2.8 Catalog product forms, units and price-kind presentation**
- `catalog/backend/catalog/products/{create,[id]}/page.tsx`,
  `components/products/{VariantBuilder,ProductUomSection}.tsx`, the price kind settings page.
- Single "Price" field under `single_price_plus_tax`, unit placeholders and validation from the profile's default unit
  codes, `tax_code` / `is_taxable` inputs, `<Alert variant="warning">` on a kind still marked `including-tax`
  (nothing rewritten automatically), `REFERENCE_UNIT_CODES` gains `lb`, `oz`, `fl_oz`, `ft2`.

**2.9 Tax rates wording**
- `sales/components/TaxRatesSettings.tsx` and `sales/i18n/en.json` (+ `sales/i18n/en-us.json`): "Tax rates" in place of
  "VAT classes". The US template seeds no rate rows.

**2.10 Sales channel and WMS warehouse address forms**
- `sales/backend/sales/channels/[channelId]/edit/page.tsx` and the WMS warehouse form pick up the shared layout.

**2.11 Shipment wizard: pounds and inches at the input boundary**
- `shipping_carriers/lib/shipment-wizard/components/{AddressFields,PackageEditor}.tsx`: placeholders and hints from the
  profile; pounds/inches labels and inputs under `us_customary`, converted to `weightKg`/`lengthCm`/`widthCm`/
  `heightCm` on submit so the carrier adapter contract stays metric (D9).

**2.12 Documents PDF paper size from the profile**
- `packages/documents/src/modules/documents/lib/{pdfHtml,pdfRenderer}.ts` read `paperSize(profile)` into the `@page`
  rule and the puppeteer format; A4 stays for a tenant with no profile.

**2.13 CSV export dates, amounts and negative style**
- `packages/shared/src/lib/crud/exporters.ts` takes the profile for dates, amounts and `negative_style`.

**2.14 Portal profile page dates**
- `portal/frontend/[orgSlug]/portal/profile/page.tsx` dates through the helpers.

**2.15 Integration tests TC-MKT-003 to TC-MKT-009**
- `TC-MKT-003` acceptance scenario end to end on a US tenant (also the hydration smoke test for the migrated quote
  detail); `TC-MKT-004` a profile-less tenant unchanged, two organizations read in sequence in one process;
  `TC-MKT-005` `us`-layout address validation plus the legacy-row warning path; `TC-MKT-006` public quote page and
  email view model under `single_price_plus_tax`; `TC-MKT-007` Letter reaches the PDF and A4 still does without a
  profile; `TC-MKT-008` CSV export; `TC-MKT-009` shipment wizard pounds/inches → kilograms/centimeters.

## Risks

- **Breadth.** ~60 files in Phase 2. Mitigation: every helper falls back to `LEGACY_DISPLAY_DEFAULTS`, so each Step
  leaves the application working and a tenant without a profile row is unaffected.
- **Migrations on a shared database.** This run uses `omw up --fresh` (own database) because it adds migrations.
- **Executor drift.** Steps are dispatched to executor subagents; the main session verifies commit, push and Tasks-row
  flip after each, checkpoints every ~5 Steps, and the final gate runs the full `validation.commands` list plus the
  integration suite and `om-ds-guardian`.
- **i18n check-sync.** The `en-us.json` overlays are intentionally partial; Step 1.10 makes that legitimate before any
  overlay ships (2.9 adds one).
- **20-Step safety checkpoint.** The dispatch reference stops for user review after ~20 consecutive Steps; this run was
  started explicitly as an unattended implementation of every in-scope phase, so the main session runs a checkpoint
  pass and continues, recording the decision in `NOTIFY.md`.

## External References

None. No `--skill-url` was passed.

## Progress

See the `## Tasks` table above.
