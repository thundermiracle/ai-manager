# Support Matrix v1

This document freezes the detection input matrix and staged scope rollout plan for issues `#106` and `#114`.

## Scope

- Target clients:
  - `claude_code`
  - `codex`
  - `cursor`
- Required matrix artifacts:
  - Binary candidate order (for CLI-first clients)
  - Config and skills path candidate order
  - Current vs target scope support per resource kind
  - Effective precedence order for source-aware listing
  - Detection evidence requirements per client
  - Path precedence policy and fallback behavior

## Deterministic Resolution Rules

1. Resolve candidate lists by ascending `priority`.
2. Prioritize candidates whose `os` includes the current runtime OS.
3. If priorities collide (should not happen), use:
   - more-specific OS match first
   - then lexical `path` order
4. If one candidate fails, continue to the next candidate in the same `kind`.

## Staged Scope Support

- `resourceKinds.mcp` captures current vs target MCP scope support per client.
- `resourceKinds.skills` stays user-only for now and records that project scope is deferred.
- `projectScopeStatus` values are:
  - `planned`: native project support is intended in a follow-up implementation issue
  - `deferred`: project scope is intentionally postponed pending taxonomy/product decisions
  - `not_applicable`: no native upstream project support is assumed
- `effectivePrecedence` records the scope ordering the UI/backend should use once the target scopes are enabled.

## Happy Path and Fallback

Each client includes both:

- `happy_path` candidates:
  - environment override path (explicit user control)
  - primary command for CLI tools
- `fallback` candidates:
  - default per-platform locations
  - alternative command name or app-data path

## File References

- Matrix JSON:
  - `docs/spec/support-matrix.v1.json`
- JSON schema:
  - `schemas/support-matrix.schema.json`
- Unit tests:
  - `tests/support-matrix.test.mjs`
