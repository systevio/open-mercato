# Notify — 2026-09-19-market-display-profile-wave1b

> Append-only log. Every entry is UTC-timestamped. Never rewrite prior entries.

## 2026-09-19T14:17:01Z — run started
- Brief: implement the remaining Phase 2 steps of `.ai/specs/2026-09-18-market-display-profile.md` (P2.2, P2.3, P2.4,
  P2.6 through P2.14); P2.1 and P2.5 landed on `develop` through PR #5; Phase 3 stays deferred.
- External skill URLs: none
- Routing: `om-auto-implement-spec` forwarded `--loop`, so `om-auto-create-pr` handed off to `om-auto-create-pr-loop`
  at the slot check without a step count.
- Decision: every Step is `inline`. The fourteen Steps share one descriptor and one set of helpers, so splitting them
  across executor subagents would make each re-derive the same context.
- Decision: the spec document itself is not committed on this branch. It merges through its own spec PR #1; it was
  checked out into the worktree only so the engine can read it.

## 2026-09-19T14:54:24Z — checkpoint 1
- Steps covered: 2.2a, 2.2b, 2.3, 2.4, 2.6a (commits 0e94e1179..71102151b).
- Targeted validation green: typecheck (shared, ui, core), the display/addressFormat/customers/calendar/sales test
  suites, `yarn generate` with no drift, `yarn build:packages`, `yarn i18n:check-sync`.
- UI verification skipped, with reason: the slot is attached to the shared instance database (no migration in this
  run, so `omw up` was correct), whose admin credentials this run does not hold, and writing the US market profile
  row needed to demonstrate the change would alter every other slot's rendering. Deferred to the final gate under
  `omw up --fresh`.
- Decision: the run fixed a pre-existing rules-of-hooks defect found in Step 2.4 (`MonthGrid.buildWeeks` called
  `useDisplayProfile()` from inside a `useMemo`) rather than routing around it.
- Decision: one no-profile rendering change was accepted and documented in Step 2.3 - the company card's
  "today, HH:MM" stamp moved to the short time style (`3:45 PM` in place of `03:45 PM` under an English UI).

## 2026-09-19T15:25:06Z — checkpoint 2
- Steps covered: 2.6b, 2.7, 2.8, 2.9, 2.10, 2.11 (commits 9fd947875..c80d7ad7d).
- Repo-wide typecheck (38 packages) and the full core, shared and ui suites are green; `yarn generate` shows no
  drift and all five locales are in sync.
- Problem found and fixed: `salesComponentsRender > renders tax rates settings rows` asserted `/VAT/`, which was
  matching the section description rather than any table row (the suite's DataTable stub never renders this
  component's row shape). Step 2.9's rewording exposed it. The assertion now counts the row, like its siblings.
- Decision: Steps 2.8 and 2.10 shipped smaller than the spec implies, for reasons recorded in their commits - the
  catalog tax fields already existed from PR #5, and the WMS warehouse dialog has no address layout to apply.
- UI verification still deferred to the final gate on `omw up --fresh`, for the reason recorded at checkpoint 1.
