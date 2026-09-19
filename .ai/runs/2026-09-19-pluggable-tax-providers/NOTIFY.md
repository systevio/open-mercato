# Notify — 2026-09-19-pluggable-tax-providers

> Append-only log. Every entry is UTC-timestamped. Never rewrite prior entries.

## 2026-09-19T07:30:00Z — run started
- Brief: implement the spec `.ai/specs/2026-09-19-pluggable-tax-providers.md` (pluggable tax providers for sales documents), all six phases.
- External skill URLs: none.
- Engine: om-auto-create-pr-loop (steps: 36, --loop: no) — routed by the step threshold of 20.
- Decision: every Step runs `inline`. The phases share one evolving contract, so executor subagents would each re-derive it and risk divergent shapes.
- Decision: the implementation branch forks the task branch, which already carries the spec commit `3afccb3` that spec PR #3 also carries. The spec file is therefore visible in this PR's diff until #3 merges; it is not re-edited here.

## 2026-09-19T09:05:00Z — run resumed, scope amended by the owner
- Resumed through `om-auto-implement-spec 3` → `om-auto-continue-pr-loop 4` (PR #4 carries a `Tracking run folder:` line, so the loop continue engine applies; the step count was not re-applied).
- Owner scope decision: MVP is Phases 1, 2, 3, 4 and 6, in that order. **Phase 5 (commit/adjust/void lifecycle: transaction events, the persistent subscriber, `sales.tax_transaction.record`, undo void) is deferred and MUST NOT be implemented.** Steps 5.1-5.5 flipped from `todo` to `deferred` in PLAN.md.
- The optional `commit`, `adjust` and `void` methods and the `capabilities` block stay in the `TaxProvider` type only (landed in Step 1.1, `lib/providers/types.ts:333-355`); nothing calls them in this run.
- Owner instruction: the implementation PR stays a **draft** against `develop`. No merge, no deploy, no package publish.
- Corrected the Step 1.2 `Commit` cell from the placeholder `pending` to `ed37ac8a9`.
- Resume point: Step 1.3 (TaxInfo and result schemas).

## 2026-09-19T10:20:00Z — spec delta recorded (Step 1.5)
- **Delta from the spec's `TaxRequestLine` / `TaxRequestCharge` tables:** two additive fields on each — `amountGross` and `taxAmount` (plus `amountGross` on the charge). The spec's own field list could not support its own central guarantee: `table-rates` is required to be "an identity over the engine's line math", but from `amountNet` and `taxRate` alone it cannot reproduce a line that carried an explicit `taxAmount` (`lib/calculations.ts:164-167`) or one whose tax came from the gross/net delta heuristic (`:177-180`). Passing the engine's own per line figure makes the identity exact instead of approximate, and it is information a real engine wants anyway (Saleor's `TaxableObject` and commercetools' external rates both carry the current tax).
- Second, smaller delta: `table-rates` emits no jurisdiction detail row for a zero-tax line. A table rate carries no jurisdiction identity, so such a row would say nothing; the spec's TC-SALES-TAX-001 assertion (one breakdown entry per line) still holds for lines that actually carry a rate.
- Both deltas are additive to types that have not shipped; nothing outside this branch depends on them. They are called out in the PR body.
