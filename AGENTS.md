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
- Always implement directly inside this repository working directory (`/Users/fengliu/Code/ai-manager`); do not use temporary clones or parallel worktrees for implementation.
- Commit and push from this repository directory, then open/update PRs from the same local workspace.
- Before every commit, run lint and unit tests (`pnpm run lint` and `pnpm test`) and commit only after both pass.
- If any Rust files are modified, always run the full `rust-quality` equivalent checks before commit/push.
- Required Rust quality command (same as CI): `pnpm run ci:rust`
- `pnpm run ci:rust` expands to the following required commands:
  - `pnpm run fmt:rust` (`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`)
  - `pnpm run lint:rust` (`pnpm run generate:tauri-icons && cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings`)
  - `pnpm run test:rust` (`pnpm run generate:tauri-icons && cargo test --manifest-path src-tauri/Cargo.toml`)
- If any frontend/web files are modified, always run the full `web-quality` equivalent checks before commit/push.
- Required web quality command (same as CI): `pnpm run ci:web`
- `pnpm run ci:web` expands to the following required commands:
  - `pnpm run lint:ts` (`pnpm run typecheck && biome check .`)
  - `pnpm test` (`pnpm run test:contracts`)
  - `pnpm run build` (`pnpm run typecheck && vite build`)
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
- Use Biome for TypeScript/JavaScript linting and formatting (`lint:ts` should run through Biome).
