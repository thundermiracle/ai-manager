# MVP Acceptance Checklist and Non-goals v1

This document defines the release gate checklist, done definitions, and explicit non-goals for issue `#13`.

## Major Flows in MVP Scope

The MVP decision is based on exactly four major flows:

1. `detection`
2. `list`
3. `add`
4. `remove`

## Release Decision Rule

- Rule: `all_blocking_items_pass`
- Meaning: any blocking checklist item failing means `no_go`
- Required evidence classes:
  - `automated_test`
  - `manual_qa`
  - `spec_review`

This contract is designed to support a release/no-release decision without interpretation ambiguity.

## Must-have Checklist

- The checklist defines blocking requirements for each major flow.
- Every item has:
  - stable ID
  - verification method
  - concrete evidence expectation
- The checklist is intentionally strict to prevent scope creep and hidden quality debt.

## Done Definition per Flow

Each major flow has:

- required checklist item references
- explicit `doneWhen` statements
- explicit `notDoneWhen` failure triggers

This allows the team to evaluate completion consistently across contributors and reviews.

## Explicit Non-goals

MVP non-goals are documented and tied to later issues to keep deferred scope explicit:

- Parser extensibility hardening (`#21`, `#31`)
- Secret redaction hardening (`#30`, `#32`)
- Full GUI polish scope (`#27`, `#28`, `#29`)
- Packaging and release automation (`#33`, `#34`, `#35`)

## Files

- Schema:
  - `schemas/mvp-acceptance-contract.schema.json`
- Canonical sample:
  - `docs/spec/mvp-acceptance-contract.v1.json`
- Unit tests:
  - `tests/mvp-acceptance-contract.test.mjs`
