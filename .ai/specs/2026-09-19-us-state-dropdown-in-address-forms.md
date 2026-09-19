# US State Dropdown In Every Address Form

## TLDR

**Key Points:**
- When the country of an address is the United States, the "Region / State" field becomes a dropdown of the US states
  from the static subdivision table that `markets` already ships (`packages/shared/src/lib/location/subdivisions.ts`).
  For any other country the field stays the free-text input it is today.
- Today the dropdown exists but is keyed off the wrong thing: `resolveAddressLayout(profile)` lists the subdivisions of
  the **market profile's home country**, so a merchant with no market (or an EU market) never sees it, and a US-market
  merchant entering a Canadian address is shown US states. This spec keys the list off the **country selected in the
  form** instead.
- One shared decision in `packages/shared/src/lib/display/address.ts`, consumed by every address form: the two
  `AddressEditor` twins (`packages/ui` and `customers`, which also serve sales documents and staff), the sales channel
  address, and the tax provider ship-from address.

**Scope:**
- A `country` aware subdivision resolution in the shared display layer, with the profile still deciding whether a
  subdivision is *required* and how the field is *labelled*.
- Every backend address form that has both a country and a region field switches the region control on the selected
  country. No storage change: `region` stays the text column it is (market display spec, invariant 2 and D8).
- Legacy rows whose `region` holds a full state name or an unknown value keep rendering and saving (invariant 5).

**Concerns:**
- The subdivision table carries 56 rows (50 states, DC, 5 territories) and the brief lists exactly 50. See Q1.
- The existing select stores the two-letter code while free text may hold "Texas". See Q2.

## Open Questions

- **Q1.** Dropdown contents for `US`: (a) exactly the 50 states in the brief, (b) 50 states plus District of Columbia,
  or (c) all 56 rows in the table (states, DC and the five territories)? Recommendation: (b), because a DC address is a
  routine shipping destination and is unreachable through a 50-entry list, while territories have their own postal
  conventions and can be entered via a follow-up.
- **Q2.** Stored value when a state is picked: (a) the USPS two-letter code (`TX`), which is what the existing select
  already stores and what the `us` address layout prints (`PLANO TX 75074`), or (b) the full name (`Texas`)?
  Recommendation: (a), with a legacy `Texas` matched case-insensitively to `TX` when the record is opened so the
  dropdown preselects it, and an unmatched value kept as-is with the existing warning badge.

## Problem Statement

`AddressEditor` (both twins), the sales channel form and the tax provider ship-from form all render a plain text
input for `region`. The market display spec added a `<Select>` over `descriptor.subdivisions`, but
`resolveAddressLayout` fills that list only when `profile.subdivisionRequired` is true and only for
`profile.defaultCountryCode`:

- An organization with no market profile, or with the `eu` template, never gets a dropdown for a US address.
- An organization with the `us` template gets US states for every country, including Canada or Mexico, and the
  warning badge then fires on every valid Canadian province.
- The tax provider ship-from form and the shipment wizard were never wired to the descriptor's subdivision list at all
  (the shipment wizard has no region field, so it is out of scope).

## Proposed Solution

Make the subdivision list a function of the selected country, and leave the profile in charge of the things that
genuinely are market decisions (label keys, whether a subdivision is required, the postal code pattern, the default
country).

- `resolveAddressLayout(profile, { country })` gains an optional second argument. When `country` is given, the list is
  `getSubdivisions(country)` (filtered per Q1); when it is absent the current behavior is kept, so the six existing
  callers compile and render unchanged.
- A small `subdivisionsForCountry(country)` helper in the same file is the one place the Q1 filter lives, so the two
  editors, the channel form and the ship-from form cannot disagree about what "US states" means.
- `AddressEditor` (both twins), `channelFormFields.ts` and `TaxProviderSettings.tsx` pass the form's current country.
  The select renders whenever the list is non-empty; the text input otherwise. Changing the country from `US` to
  another country keeps the typed value and switches back to a text input; changing to `US` with a value that is not in
  the list keeps the value, shows the existing warning badge and lets the user pick from the list.
- `validateAddressForProfile` checks `region` against the *address's* country, which it already does, so no change
  there beyond the Q1 filter.

## Phasing

- **Phase 1**: shared helper and its unit tests; both `AddressEditor` twins.
- **Phase 2**: sales channel address form and tax provider ship-from form; integration test on the customer address
  path.

Implementation steps, test IDs, risks and the compliance report follow once Q1 and Q2 are answered.
