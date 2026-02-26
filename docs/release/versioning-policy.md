# Versioning Policy v1

This project uses semantic versioning for issue `#34`.

## Version Format

- Stable format: `MAJOR.MINOR.PATCH`
- Optional pre-release format: `MAJOR.MINOR.PATCH-rc.N`

## Deterministic Increment Rules

1. Bump `MAJOR` when any change is backward-incompatible for users or integrators.
   - Examples:
     - remove or rename Tauri command contracts
     - incompatible schema changes under `schemas/`
     - remove support for a previously supported client
2. Bump `MINOR` when adding backward-compatible capabilities.
   - Examples:
     - new non-breaking fields in responses
     - new optional UI flows
     - additional backward-compatible adapters
3. Bump `PATCH` for backward-compatible fixes and docs-only updates.
   - Examples:
     - bug fixes without contract breaks
     - performance/stability improvements
     - test-only or documentation-only corrections

## Release Candidate Rules

- Use `-rc.N` only for release validation builds.
- `N` increments by 1 for each candidate cut from the same target version.
- Final release removes `-rc.N` without changing `MAJOR.MINOR.PATCH`.

## Change Classification Checklist

1. Does this release break existing behavior or contracts?
   - yes: `MAJOR`
2. Does this release add backward-compatible functionality?
   - yes: `MINOR`
3. Otherwise:
   - `PATCH`

## Required Artifacts

- Updated version in project metadata.
- Completed checklist in `docs/release/release-checklist.md`.
- Notes generated from `docs/release/release-notes-template.md`.
