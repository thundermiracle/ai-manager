# Agent Instructions

## Implementation Quality

- Follow SOLID principles.
- Keep modules cohesive and separate concerns.
- Do not place unrelated functions in the same file.

## Issue and PR Workflow

- Implement work one issue at a time.
- Create pull requests per issue.
- Include unit tests for each implementation issue.
- Add or update CI test coverage when applicable.
- Before every commit, run lint and unit tests (`pnpm run lint` and `pnpm test`) and commit only after both pass.
- Keep Rust and TypeScript changes in separate commits when both are touched in the same issue.

## Phase Gate

- Stop after completing one phase.
- Request review before continuing to the next phase.

## Toolchain Policy

- Always select the latest stable library versions when adding or updating dependencies.
- Before creating a PR, verify there are no stale dependencies with `pnpm outdated`.
- Target Node.js `v24` and Rust `2024 edition`.
- Always use `pnpm` commands instead of `npm` (for example: `pnpm install`, `pnpm test`).
- Use `pnpm` as the package manager.
