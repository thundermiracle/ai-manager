# Release Checklist v1

This checklist standardizes release gating for issue `#34`.

## Release Readiness Rule

- Decision: `go` only if every blocking item below is complete with evidence.
- Evidence types:
  - `automated_test`
  - `artifact_validation`
  - `manual_smoke`
  - `release_notes_review`

## Blocking Checklist

1. Quality gate: `pnpm run ci` passes on `main`.
   - Evidence: CI run URL and successful status.
2. Packaging gate: macOS DMG workflow succeeds.
   - Evidence: `.dmg` artifact and `dist/macos/dmg-manifest.json`.
3. Install/launch smoke gate: packaged app installs and launches on macOS.
   - Evidence: manual log with install path and launch confirmation.
4. Contract stability gate: no unintended breaking schema changes.
   - Evidence: diff review for files in `docs/spec/*.v1.json` and `schemas/*.schema.json`.
5. Release communication gate: release notes are prepared from template.
   - Evidence: completed notes using `docs/release/release-notes-template.md`.

## Release Execution Steps

1. Confirm all blocking checklist items are complete.
2. Determine next version using `docs/release/versioning-policy.md`.
3. Create release notes from template and include:
   - highlights
   - compatibility notes
   - known issues
4. Create git tag `vX.Y.Z`.
5. Publish release artifacts and notes.

## Post-release Validation

1. Install latest DMG on a clean macOS account.
2. Verify client detection and list flows still work.
3. Archive release evidence links in the release ticket.
