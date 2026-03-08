# Tests

The test suite is intentionally minimal and focuses on stable contract invariants for the current source-aware rollout.

## Included Tests

- `tests/error-ui-contract.test.mjs`
- `tests/normalized-domain-model.test.mjs`
- `tests/support-matrix.test.mjs`
- `tests/mvp-acceptance-contract.test.mjs`

## Why These Only

- They validate JSON contract structure and consistency.
- They pin staged support assumptions such as `current*Scopes` vs `target*Scopes`.
- They are less brittle than source-text UI/implementation guards.
- They keep maintenance cost low while preserving core compatibility checks.

## Commands

- `pnpm test` runs the contract suite.
- `pnpm run test:contracts` runs the same suite explicitly.
