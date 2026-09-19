# Notify - 2026-09-19-us-state-dropdown-in-address-forms

> Append-only log. Every entry is UTC-timestamped. Never rewrite prior entries.

## 2026-09-19T00:00:00Z — run started
- Brief: implement `.ai/specs/2026-09-19-us-state-dropdown-in-address-forms.md` - the region control becomes a US state
  dropdown keyed off the address's own country, across the two AddressEditor twins, the sales channel form and the tax
  provider ship-from form.
- External skill URLs: none
- Engine: `om-auto-create-pr-loop` (spec-implementation run, 9 Steps).
- Decision: the branch is cut from `spec/us-state-dropdown-in-address-forms`, not from `develop`, because the release
  step of this workflow merges the spec PR (#11) and this implementation PR together. The spec document is therefore
  already present on the branch and is not re-committed.
- Decision: the implementation PR opens as a draft against `develop` at the user's instruction, so the release step
  owns the promotion.
