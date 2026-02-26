# Error Taxonomy and UI State Contract v1

This document defines the canonical error taxonomy and deterministic UI state mappings for issue `#12`.

## Error Categories

MVP supports exactly six categories:

1. `parse`
2. `permission`
3. `validation`
4. `conflict`
5. `io`
6. `unknown`

Each category includes:

- `canonicalCode`: stable machine-readable error code
- `messagePattern`: user-visible template with placeholders
- `suggestedActions`: one or more concrete next actions
- `nonActionable`: must be `false` for MVP

## Generic Error Policy

- Generic phrases like `something went wrong` are disallowed.
- Unknown failures are normalized through the fallback policy:
  - category: `unknown`
  - code: `AM_UNKNOWN_999`
  - message template with explicit operation/resource context
  - actionable fallback suggestions

## UI States

The UI contract freezes these states:

- `idle`
- `loading`
- `success_full`
- `success_empty`
- `success_partial`
- `error`

Each state has explicit rendering flags (`showSpinner`, `showData`, `showEmptyHint`, `showWarningBanner`, `showErrorBanner`, `allowRetry`) to keep behavior deterministic.

## Flow Contracts

Three flow contracts are defined:

1. `detection`
2. `read`
3. `write`

All flows specify:

- single initial state
- terminal states
- transition table (`from` + `event` -> `to`)
- `outcomeToState` mapping for loading/empty/partial/full/error outcomes
- `errorCategoryToState` mapping for all six categories

## Files

- Schema:
  - `schemas/error-ui-contract.schema.json`
- Canonical sample:
  - `docs/spec/error-ui-contract.v1.json`
- Unit tests:
  - `tests/error-ui-contract.test.mjs`
