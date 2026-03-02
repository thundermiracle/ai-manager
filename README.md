# AI Manager

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="AI Manager app icon" width="96" height="96" />
</p>

AI Manager is a desktop app that helps you manage MCP servers and Skills across supported AI clients from one place.

## For Users

### Download and Install (macOS)

1. Open the latest release: <https://github.com/thundermiracle/ai-manager/releases/latest>
2. Download the `.dmg` file from **Assets**.
3. Open the DMG and drag `AI Manager.app` into `/Applications`.
4. Launch `AI Manager` from Applications.

### What You Can Do

- Detect supported AI clients on your machine.
- Inspect registered MCP and Skill resources.
- Apply safe resource mutations through a unified interface.

## Developer Setup

### Prerequisites

- Node.js `v24+`
- pnpm `10.x`
- Rust stable toolchain (`edition = 2024`)

### Install and Run

1. Install dependencies: `pnpm install`
2. Start desktop app in dev mode: `pnpm tauri:dev`

### Quality Checks

- Lint: `pnpm run lint`
- Unit tests: `pnpm test`

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
