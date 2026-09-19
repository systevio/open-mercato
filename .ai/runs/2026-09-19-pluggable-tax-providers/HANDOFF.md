# Handoff — 2026-09-19-pluggable-tax-providers

**Last updated:** 2026-09-19T11:05:00Z
**Branch:** feat/pluggable-tax-providers
**PR:** #4 (draft, base `develop`)
**Current phase/step:** Phase 2 Step 2.1
**Last commit:** c7fdd2b63 (Step 1.8)

## What just happened
- **Phase 1 is complete** (Steps 1.1 to 1.8). Checkpoint 1 recorded in `checkpoint-1-checks.md`.
- The contract, the registry, the `TaxInfo` schemas, the context assembly, the `table-rates` and
  `fixed-rate` providers, the tax stage and all eighteen recalculation sites are landed and green:
  116 sales suites / 897 tests, `yarn typecheck` and `yarn build:packages` clean.
- Nothing is persisted yet. The result lives in `calculation.metadata.tax`; Phase 2 adds the columns.

## Next concrete action
- **Step 2.1:** add the tax columns to `SalesInvoice` and `SalesCreditMemo` (five each), the four
  missing ones to `SalesQuote` (`tax_info` already exists) and the three missing ones to `SalesOrder`
  in `data/entities.ts`; then `yarn db:generate`, keep only the sales migration, and update
  `migrations/.snapshot-open-mercato.json`.

## Blockers / open questions
- **Scope:** Phase 5 is deferred by the owner and must NOT be implemented. Steps 5.1-5.5 are
  `deferred` in `PLAN.md`. The optional `commit` / `adjust` / `void` methods and the `capabilities`
  block stay in the `TaxProvider` type only (`lib/providers/types.ts`). MVP is Phases 1, 2, 3, 4, 6.
- **The PR stays a draft** against `develop` — the owner's instruction, and independently the spec's
  Q7 `⚠ NEEDS HUMAN CONFIRMATION` row (core-owned semantics for `tax_strategy_key` / `tax_info`).
- No merge, no deploy, no package publish.

## Spec deltas recorded so far
- `TaxRequestLine` gains `amountGross` and `taxAmount`; `TaxRequestCharge` gains `amountGross` and
  `taxAmount`. Without the engine's own per line figure, `table-rates` cannot be the exact identity
  the spec's central guarantee requires. See the NOTIFY entry at 2026-09-19T10:20:00Z.
- The catalog fact lookup in `resolveTaxDocumentContext` is lazy (`loadProductFacts`, default off for
  `table-rates`), so the default path adds no query to any document write and the two return
  recalculations that run inside an open transaction stay query free.
- `table-rates` emits no jurisdiction detail row for a zero-tax line.

## Known pre-existing failures (not this branch)
- `@open-mercato/cli`: 5 tests in `resolve-environment.test.ts` and `resolver.enterprise.test.ts`.
  Reproduced on `origin/develop` in this worktree. This branch touches no file under `packages/cli`.

## Environment caveats
- Dev runtime runnable: yes (`omw up`, slot 1, port 3110, https://task1-om.systevio.dev).
- Runner: local (`yarn X`) — no compose `app` container is running.
- Browser / UI checks: available through the repository's Playwright integration suite. Nothing to
  capture yet; the first UI surface lands in Step 2.7.
- Database/migration state: shared instance database. Migrations are authored and committed but
  NEVER applied from this worktree. Step 2.1 authors one; do not run `yarn db:migrate`.

## Worktree
- Path: /srv/om/repos/open-mercato/.ai/cezar/worktrees/3210729b-2d8c-49cf-a3ea-8e7ef0f83216
  (resumed session; the first session ran in worktree 8aab749e)
- Created this run: no (reused the task's linked worktree)
