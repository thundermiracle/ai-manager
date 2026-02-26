# Module Boundaries (Issue #16)

This project uses explicit backend layers to keep client-specific behavior isolated.

## Layer Responsibilities

- `domain/`
  - Owns adapter interface (`ClientAdapter`) and client profile/capability definitions.
  - Contains types that describe adapter behavior without binding to concrete client implementations.
- `detection/`
  - Owns detector interface (`ClientDetector`) and shared detection framework.
  - Defines detector registry and per-client detector implementations that emit one schema.
- `adapters/`
  - Contains concrete adapter implementations for each supported client.
  - Current scaffold adapters: Claude Code, Codex CLI, Cursor, Codex App.
- `infra/`
  - Provides infrastructure wiring (`AdapterRegistry`) that composes adapters.
  - Exposes registry lookup/iteration used by application services.
- `application/`
  - Coordinates use-cases (`AdapterService`) and maps detector/adapter outputs to command contracts.
- `commands/`
  - Thin Tauri command boundary; handles envelope metadata and delegates business flow.

## Extension Rule

To add a new client adapter, implement `ClientAdapter` in a new file under `adapters/` and register it in `infra/adapter_registry.rs`.
To add a new detector, implement `ClientDetector` in `detection/clients/` and register it in `detection/detector_registry.rs`.
Command and UI layers should remain unchanged.
