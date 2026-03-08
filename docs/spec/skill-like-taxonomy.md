# Skill-Like Resource Taxonomy

This document closes issue `#110` by separating AI Manager-managed generic skills from client-native agent features.

## Resource Families

### Generic Skills

- Represented today by the `Skills` tab and the normalized `skill` resource kind.
- Stored as `SKILL.md` manifests inside client-specific personal directories such as `~/.cursor/skills`.
- Managed by AI Manager, not by upstream client-native project features.
- Personal-only for now across Claude Code, Codex, and Cursor.

### Native Agent Features

- Represent upstream client-native concepts that do not map cleanly to generic `SKILL.md` repositories.
- Claude Code project-native customization belongs here.
- Claude should be modeled as `subagents` or an equivalent native resource kind rather than folded into generic `skill`.
- Native project scope must remain separate from AI Manager-managed generic repositories in both docs and UI.

## Client Classification

| Client | Generic personal skills | Native project feature | Product stance |
| --- | --- | --- | --- |
| Claude Code | Supported as AI Manager-managed `SKILL.md` repository | Subagents / agents | Do not treat Claude project-native support as `skill`; model it as the separate `subagent` resource kind |
| Codex | Supported as AI Manager-managed `SKILL.md` repository | None confirmed | Keep generic skills personal-only |
| Cursor | Supported as AI Manager-managed `SKILL.md` repository | None confirmed comparable to Claude subagents | Keep generic skills personal-only |

## Product Rules

1. Keep the current `Skills` tab scoped to AI Manager-managed personal repositories.
2. Do not imply that the `Skills` tab exposes native Claude project customization.
3. Treat native project-scoped agent features as a separate product surface and contract.
4. Keep support matrix entries explicit about `native` vs `generic/project-managed` support.

## Staged Rollout

1. Ship project-aware MCP independently.
2. Keep generic skills personal-only with explicit copy in the UI and docs.
3. Keep native Claude subagents on their own contract and UI surface.
4. Revisit project-scoped generic repositories only if there is a product reason beyond parity with client-native features.

## Follow-Up Issues

- `#139` Separate generic skill libraries from native client resources in the UI and contracts.
