# Handoff — 2026-09-19-pluggable-tax-providers

**Last updated:** 2026-09-19T09:05:00Z
**Branch:** feat/pluggable-tax-providers
**PR:** #4 (draft, base `develop`)
**Current phase/step:** Phase 1 Step 1.3
**Last commit:** ed37ac8a9 (Step 1.2)

## What just happened
- Run folder created from the spec `.ai/specs/2026-09-19-pluggable-tax-providers.md`; 36 Steps across 6 phases.
- Steps 1.1 and 1.2 landed (contract types, registry).
- Run resumed on a new session. The owner cut Phase 5 from the MVP: Steps 5.1-5.5 are `deferred` in PLAN.md and are not implemented. 31 Steps remain implementable.

## Next concrete action
- Step 1.3: add `lib/providers/taxInfo.ts` with `taxInfoSchema`, `taxProviderResultSchema` and the `round`-based normalization helpers.

## Blockers / open questions
- Spec Q7 carries a ⚠ NEEDS HUMAN CONFIRMATION row (reuse of `tax_strategy_key` / `tax_info`). The implementation follows the applied default; the PR stays a draft until a human confirms.
- The owner also instructed the PR to stay a draft against `develop` regardless: no merge, no deploy, no package publish.
- Phase 5 is out of scope. The optional `commit`/`adjust`/`void` methods and `capabilities` stay typed on `TaxProvider`; no subscriber, no lifecycle events, no `sales.tax_transaction.record`.

## Environment caveats
- Dev runtime runnable: yes (`omw up`, slot 1, port 3110).
- Browser / UI checks: available through the repository's Playwright integration suite.
- Database/migration state: shared instance database. Migrations are authored and committed but NEVER applied from this worktree.

## Worktree
- Path: /srv/om/repos/open-mercato/.ai/cezar/worktrees/3210729b-2d8c-49cf-a3ea-8e7ef0f83216 (resumed session; the first session ran in worktree 8aab749e)
- Created this run: no (reused the task's linked worktree)
