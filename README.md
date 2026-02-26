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
- Unit tests: `pnpm test`

## Project Structure

- `src/`: React frontend application.
- `src-tauri/`: Rust backend and Tauri application shell.
- `docs/spec/`: MVP requirements and contracts.
- `schemas/`: JSON schema contracts for specs.
- `tests/`: Node.js unit tests for spec and bootstrap contracts.

## Notes

- The frontend calls a Rust command (`greet`) to validate frontend-backend wiring.
- `src-tauri/tauri.conf.json` is configured to use `pnpm` for both dev and build hooks.
- `scripts/ensure-tauri-icon.mjs` generates the required Tauri icon in clean environments.
