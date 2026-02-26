# macOS DMG Packaging

This project provides a reproducible macOS-first packaging pipeline that generates a DMG artifact
and a checksum manifest.

## Prerequisites

- macOS host (Apple Silicon or Intel)
- Node.js `v24`
- `pnpm` `10.30.3`
- Rust stable toolchain
- Xcode Command Line Tools installed

## Clean-Machine Packaging Steps

1. Install dependencies:
   - `pnpm install --frozen-lockfile`
2. Build and package:
   - `pnpm run package:macos:dmg`
3. Verify outputs:
   - DMG artifact directory: `src-tauri/target/release/bundle/dmg/`
   - Packaging manifest: `dist/macos/dmg-manifest.json`

The manifest includes:
- artifact file name
- relative output path
- byte size
- SHA256 hash
- product metadata from `tauri.conf.json`

## Pre-release Sanity Checks

1. Mount DMG and copy `AI Manager.app` into `/Applications`.
2. Launch once from terminal:
   - `open /Applications/AI\\ Manager.app`
3. Verify application boot:
   - App shell renders
   - Supported client cards are visible
   - No immediate crash on startup
4. Confirm artifact metadata:
   - Compare local DMG SHA256 with `dist/macos/dmg-manifest.json`

## CI Pipeline

The workflow [`.github/workflows/macos-dmg.yml`](../../.github/workflows/macos-dmg.yml) runs on
`macos-14` and:

- executes `pnpm run package:macos:dmg`
- validates DMG and manifest outputs exist
- uploads DMG and manifest as build artifacts
