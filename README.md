# AI Manager

Tauri 2 + React/TypeScript desktop foundation for managing MCP and Skills across supported AI clients.

## Prerequisites

- Node.js `v24+`
- pnpm `10.x`
- Rust stable toolchain (`edition = 2024`)

## Commands

- Install dependencies: `pnpm install`
- Frontend dev server: `pnpm dev`
- Desktop dev mode: `pnpm tauri:dev`
- Frontend production build: `pnpm build`
- Desktop production build: `pnpm tauri:build`
- TypeScript lint + typecheck: `pnpm run lint:ts`
- Rust lint: `pnpm run lint:rust`
- Rust format check: `pnpm run fmt:rust`
- Rust unit tests: `pnpm run test:rust`
- Full lint checks: `pnpm run lint`
- Pre-commit verification (lint + unit tests): `pnpm check`
- Unit tests: `pnpm test`
- CI-equivalent web gate: `pnpm run ci:web`
- CI-equivalent rust gate: `pnpm run ci:rust`
- Full CI-equivalent gate: `pnpm run ci`

## Project Structure

- `src/`: React frontend application.
- `src/backend/`: Typed frontend contracts and Tauri invoke client.
- `src-tauri/`: Rust backend and Tauri application shell.
- `src-tauri/src/domain/`: Domain layer (adapter interfaces, client profiles, capabilities).
- `src-tauri/src/detection/`: Shared detector framework and per-client detectors.
- `src-tauri/src/adapters/`: Client-specific adapter implementations.
- `src-tauri/src/infra/`: Infrastructure composition (adapter registry).
- `src-tauri/src/application/`: Use-case service layer consumed by commands.
- `docs/spec/`: MVP requirements and contracts.
- `docs/architecture/`: Module boundary and design documentation.
- `schemas/`: JSON schema contracts for specs.
- `tests/`: Node.js unit tests for spec and project contracts.

## Notes

- The frontend command runner calls typed placeholder backend commands: `detect_clients`, `list_resources`, and `mutate_resource`.
- Command responses use a shared envelope (`ok`, `data`, `error`, `meta`) with lifecycle and operation metadata.
- Backend commands are thin boundaries and delegate to `AdapterService` through `AdapterRegistry`.
- CI runs separate `web-quality` and `rust-quality` jobs on pull requests and pushes to `main`.
- `src-tauri/tauri.conf.json` is configured to use `pnpm` for both dev and build hooks.
- `scripts/ensure-tauri-icon.mjs` generates the required Tauri icon in clean environments.
