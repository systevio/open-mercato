# Market display currency completion

Source doc: .ai/specs/2026-09-18-market-display-profile.md

## Goal

Recover the cancelled implementation and complete every first-party OSS money presentation surface so the market profile controls display conventions and supported pristine-create defaults without relabelling explicit stored currencies.

## Scope

- Audit the complete tracked OSS currency display surface and record every surface as fixed, already compliant, or a justified data-contract/owner exclusion.
- Add complete, tenant-scoped active/won deal subtotals grouped by currency to the company detail API.
- Migrate the reported company KPI path plus backend, public/portal, widgets, previews, notifications, emails, PDFs and human-readable exports to the existing market-profile formatter.
- Apply supported profile defaults only to pristine unbound create forms, and add the narrow repository lint guard required by amendment C2.6.
- Add regression tests, OpenAPI/type coverage, translations, and compatibility guidance.

## Non-goals

- No currency conversion, stored-currency rewrite, seed rerun, migration, or production-data mutation.
- No enterprise or external official-module edits.
- No unrelated date, address, tax, measurement, or market-profile foundation work.

## Implementation Plan

### Phase 1: Audit and contracts

1. Reproduce with deterministic fixtures when the reported remote company is inaccessible, audit tracked OSS currency consumers, and record each relevant file as migrated, compliant, exempt, or externally owned.
2. Add additive grouped KPI response fields, OpenAPI/types, compatibility guidance, and scoped API regressions covering mixed currencies, unknown denominations, invalid amounts, and full aggregation beyond the preview.

### Phase 2: Reported company path

3. Migrate `CompanyKpiBar`, `ActiveDealCard`, and all first-party callers of the customer detail currency helper to the existing profile-aware money formatter without changing legacy helper behavior.
4. Add component/helper regressions and translated empty, mixed, unknown, and incomplete states; verify the reported company route with deterministic US fixtures.

### Phase 3: Complete C2 coverage

5. Migrate all non-exempt OSS money consumers, including public/portal, widgets, previews, emails, PDFs and human exports, while keeping provider payloads and machine exports raw.
6. Add the narrow money-format lint rule and close the repository-wide inventory with reviewed exceptions.

### Phase 4: Verification and review

7. Run the configured validation gate, complete the authoritative autofix review loop, and capture live UI evidence for the company detail tile and representative create-default flow.

## Risks

- Existing scalar KPI fields are unsafe for mixed currencies; they remain only as a deprecated compatibility bridge while new UI consumes grouped totals.
- A display profile must never relabel an explicit stored currency. Tests cover explicit PLN under a US profile.
- The implementation and PR remain on `systevio/open-mercato`, based on `develop`; upstream is read-only.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Audit and contracts

- [ ] 1.1 Audit and record currency consumer dispositions
- [ ] 1.2 Add grouped KPI API contract and regression coverage

### Phase 2: Reported company path

- [ ] 2.1 Migrate customer detail money consumers to profile-aware formatting
- [ ] 2.2 Add UI/helper regressions and deterministic route verification

### Phase 3: Complete C2 coverage

- [ ] 3.1 Complete C2 backend and interactive consumer coverage
- [ ] 3.2 Complete public/portal, widget, preview, email, PDF and human-export coverage
- [ ] 3.3 Add the money-format lint guard and close the audit inventory

### Phase 4: Verification and review

- [ ] 4.1 Run the full gate, autofix review, and UI evidence pass
