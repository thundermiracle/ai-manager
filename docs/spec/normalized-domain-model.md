# Normalized Domain Model v1

This document defines the normalized model required by issue `#11`.

## Design Goals

- Represent all supported client formats without lossy conversion.
- Keep model boundaries clear across `Client`, `MCP`, and `Skill`.
- Expose explicit extension points for future attributes.
- Keep source traceability (`origin/path/line/column/warnings`) for every normalized entity.

## Entity Boundaries

1. `Client`
- Runtime detection status and capabilities.
- No MCP/Skill payload fields embedded directly.

2. `MCP`
- Runtime configuration details for tool servers.
- Transport and environment fields are isolated in dedicated sub-objects.

3. `Skill`
- Installation target and metadata independent from MCP transport details.

## Lossless Mapping Strategy

- Every normalized entity includes:
  - `source`: where the normalized item came from
  - `raw`: provider/client-specific original fields
- `raw` ensures that unsupported vendor fields can be retained without changing the normalized schema.

## Extension Points

- Every entity includes `extensions: {}` for forward-compatible attributes.
- Extensions are intentionally unconstrained to avoid schema churn when new clients are added.

## Files

- Schema:
  - `schemas/normalized-domain-model.schema.json`
- Canonical sample:
  - `docs/spec/normalized-domain-model.v1.json`
- Unit tests:
  - `tests/normalized-domain-model.test.mjs`
