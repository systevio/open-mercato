# Notify — 2026-09-19-pluggable-tax-providers

> Append-only log. Every entry is UTC-timestamped. Never rewrite prior entries.

## 2026-09-19T07:30:00Z — run started
- Brief: implement the spec `.ai/specs/2026-09-19-pluggable-tax-providers.md` (pluggable tax providers for sales documents), all six phases.
- External skill URLs: none.
- Engine: om-auto-create-pr-loop (steps: 36, --loop: no) — routed by the step threshold of 20.
- Decision: every Step runs `inline`. The phases share one evolving contract, so executor subagents would each re-derive it and risk divergent shapes.
- Decision: the implementation branch forks the task branch, which already carries the spec commit `3afccb3` that spec PR #3 also carries. The spec file is therefore visible in this PR's diff until #3 merges; it is not re-edited here.
