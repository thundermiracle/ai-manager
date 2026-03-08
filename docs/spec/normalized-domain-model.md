# Normalized Domain Model v1

This document defines the source-aware normalized model required by issues `#106` and `#114`.

## Design Goals

- Represent all supported client formats without lossy conversion.
- Keep model boundaries clear across `Client`, `MCP`, and `Skill`.
- Expose explicit extension points for future attributes.
- Keep source traceability for every normalized entity.
- Separate source-aware record identity from logical resource identity.
- Make staged source/destination support explicit without pretending all clients share the same native scope model.

## Entity Boundaries

1. `Client`
- Runtime detection status and capabilities.
- No MCP/Skill payload fields embedded directly.
- `capabilities.scopeSupport` records current vs target source/destination scopes for each resource kind.

2. `MCP`
- Runtime configuration details for tool servers.
- Transport and environment fields are isolated in dedicated sub-objects.
- `id` is source-aware; `logicalId` stays stable across scopes.
- `source` carries scope, source container, effective state, and shadowing metadata.

3. `Skill`
- Installation target and metadata for AI Manager-managed generic `SKILL.md` repositories.
- Uses the same source-aware identity and source metadata pattern as MCP records.
- Does not represent client-native Claude subagents; that requires a separate native resource kind.

## Lossless Mapping Strategy

- Every normalized entity includes:
  - `source`: where the normalized item came from
  - `raw`: provider/client-specific original fields
- `raw` ensures that unsupported vendor fields can be retained without changing the normalized schema.
- Source-aware records keep both `id` and `logicalId` so the same named resource can coexist across multiple sources.

## Extension Points

- Every entity includes `extensions: {}` for forward-compatible attributes.
- Extensions are intentionally unconstrained to avoid schema churn when new clients are added.

## Staged Support

- `current*Scopes` describe what the repo can list/mutate today.
- `target*Scopes` describe the intended source-aware model for staged rollout.
- Codex remains user-only unless upstream project-local MCP support becomes official.
- Generic skills remain personal-only after `#110`; native Claude project support moves to a future subagent resource kind instead of extending `skill`.

## Files

- Schema:
  - `schemas/normalized-domain-model.schema.json`
- Canonical sample:
  - `docs/spec/normalized-domain-model.v1.json`
- Unit tests:
  - `tests/normalized-domain-model.test.mjs`
