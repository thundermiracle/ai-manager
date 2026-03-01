# Test Suite Classification (MJS)

This repository currently uses `node --test` with source-level contract checks.
Most `*.mjs` tests are text guards (`assert.match` / `assert.doesNotMatch`) instead of behavior tests.

## Decision Categories

- `KEEP`: Keep as-is. High signal, low brittleness, schema/contract focused.
- `REFACTOR`: Keep intent, but reduce brittle string matching by parsing structured artifacts or testing behavior.
- `REPLACE`: Replace with runtime/behavior tests (Rust unit/integration or frontend component tests) and then remove.

## File-by-file Classification

| File | Category | Why | Next Action |
| --- | --- | --- | --- |
| `tests/error-ui-contract.test.mjs` | KEEP | JSON contract invariants (states, transitions, mappings) | Keep as contract gate |
| `tests/normalized-domain-model.test.mjs` | KEEP | JSON schema-like structure and cross-refs | Keep as contract gate |
| `tests/support-matrix.test.mjs` | KEEP | Deterministic client/path priority constraints | Keep as contract gate |
| `tests/mvp-acceptance-contract.test.mjs` | KEEP | Release/flow acceptance contract integrity | Keep as contract gate |
| `tests/ci-baseline.test.mjs` | REFACTOR | CI policy is useful, but regex against YAML is brittle | Parse workflow YAML / script presence structurally |
| `tests/macos-packaging.test.mjs` | REFACTOR | Packaging policy useful; source-text checks brittle | Add script-level behavior checks and targeted integration checks |
| `tests/operator-docs.test.mjs` | REFACTOR | Good doc-to-implementation linkage intent | Convert to data-driven checks from exported constants where possible |
| `tests/release-governance.test.mjs` | REFACTOR | Release policy guard useful but wording-sensitive | Validate required sections using lightweight markdown AST rules |
| `tests/adapter-boundaries.test.mjs` | REPLACE | Rust source string scanning duplicates existing Rust tests | Move boundary checks to Rust tests/API-level contracts |
| `tests/command-boundary.test.mjs` | REPLACE | Compile-time/runtime boundary should be tested via commands, not source strings | Add command integration tests (Rust + TS client contract tests) |
| `tests/cli-detectors.test.mjs` | REPLACE | Detector behavior already testable in Rust | Expand `path_based`/detector Rust tests and drop text guards |
| `tests/desktop-detectors.test.mjs` | REPLACE | Same as above; source text brittle | Keep behavior in Rust detection/probe tests |
| `tests/client-install-guides.test.mjs` | REPLACE | URL map text check has low runtime value | Replace with typed map tests in TS unit runner |
| `tests/client-status-ui-behavior.test.mjs` | REPLACE | UI class/text matching is fragile | Replace with component behavior tests |
| `tests/gui-shell.test.mjs` | REPLACE | Route/layout checks should be rendered behavior | Replace with render-level route tests |
| `tests/mcp-manager-panel.test.mjs` | REPLACE | Many literal string checks; high maintenance | Replace with interaction tests |
| `tests/skills-manager-panel.test.mjs` | REPLACE | Same pattern; high false-positive risk | Replace with interaction tests |
| `tests/recovery-ux.test.mjs` | REPLACE | Recovery UX should be asserted through rendered states | Replace with UI behavior tests |
| `tests/redaction-policy.test.mjs` | REPLACE | Security behavior should be tested by function outputs | Add direct redaction function tests |
| `tests/slide-over-panel.test.mjs` | REPLACE | Tailwind class string checks are brittle | Replace with semantic/behavioral checks |
| `tests/snackbar-ui.test.mjs` | REPLACE | Animation internals checked as text | Replace with timer/visibility behavior tests |

## Operational Split (Current State)

Use dedicated scripts to make intent explicit:

- `pnpm run test:contracts`: High-signal schema/contract tests (recommended baseline).
- `pnpm run test:policy`: Docs/CI/release policy linkage tests.
- `pnpm run test:text-guards`: Brittle source-text guards slated for replacement.

## Suggested Migration Order

1. Keep `test:contracts` as required CI gate.
2. Refactor `test:policy` to reduce wording brittleness.
3. Introduce behavior tests (Rust/TS) for REPLACE group.
4. Delete replaced text-guard files gradually.
