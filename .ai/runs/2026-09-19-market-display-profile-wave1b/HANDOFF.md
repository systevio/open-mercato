# Handoff — 2026-09-19-market-display-profile-wave1b

**Last updated:** 2026-09-19T14:54:24Z
**Branch:** feat/market-display-profile-wave1b
**PR:** https://github.com/systevio/open-mercato/pull/7 (draft)
**Current phase/step:** Phase 2 Step 2.7
**Last commit:** 71102151b — feat(sales): document money and dates render in the market's conventions

## What just happened
- Checkpoint 1 passed over Steps 2.2a..2.6a: typecheck, the shared/ui/customers/calendar/sales test suites,
  `yarn generate` (no drift), `yarn build:packages` and `yarn i18n:check-sync` are all green.
- The address layer, customers surfaces, the CRM calendar and the sales document money and date chokepoints now all
  read the resolved market display profile.

## Next concrete action
- Start Step 2.7: the public quote page and the two quote emails render from a server-built preformatted view model.

## Blockers / open questions
- none blocking. UI screenshots are deferred to the final gate and need `omw up --fresh` (see Environment caveats).

## Environment caveats
- Dev runtime runnable: yes. The slot's dev server serves the app on `http://localhost:3005` (the runtime picked that
  port, not the `PORT=3120` in `.env`; `.ai/qa/test-env.json` still records 3120).
- Browser / UI checks: skipped so far. The slot is on the **shared instance** database, whose admin credentials this
  run does not hold, and writing the US profile row needed to demonstrate the change would alter every other slot's
  rendering. Take `omw up --fresh` at the final gate, seed a US profile there, capture screenshots.
- Database/migration state: clean. This run adds no migration.

## Worktree
- Path: /srv/om/repos/open-mercato/.ai/cezar/worktrees/fac8bef7-a46a-43e6-ad82-2f5281f491d1
- Created this run: no (the cezar task worktree is reused)
