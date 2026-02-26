import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tauriConfig = JSON.parse(
  readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
);
const cargoToml = readFileSync(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
const mainRs = readFileSync(new URL("../src-tauri/src/main.rs", import.meta.url), "utf8");
const iconScript = readFileSync(
  new URL("../scripts/ensure-tauri-icon.mjs", import.meta.url),
  "utf8",
);

test("package scripts expose desktop and frontend bootstrap commands", () => {
  assert.equal(packageJson.packageManager, "pnpm@10.30.3");
  assert.equal(packageJson.engines.node, ">=24.0.0");
  assert.equal(typeof packageJson.scripts.dev, "string");
  assert.equal(typeof packageJson.scripts.build, "string");
  assert.equal(typeof packageJson.scripts["tauri:dev"], "string");
  assert.equal(typeof packageJson.scripts["tauri:build"], "string");
  assert.equal(typeof packageJson.scripts["ensure:tauri-icon"], "string");
  assert.equal(typeof packageJson.scripts["pretauri:dev"], "string");
  assert.equal(typeof packageJson.scripts["pretauri:build"], "string");
  assert.equal(typeof packageJson.scripts.typecheck, "string");
  assert.equal(typeof packageJson.scripts["fmt:rust"], "string");
  assert.equal(typeof packageJson.scripts["test:rust"], "string");
  assert.equal(typeof packageJson.scripts["lint:ts"], "string");
  assert.equal(typeof packageJson.scripts["lint:rust"], "string");
  assert.equal(typeof packageJson.scripts.lint, "string");
  assert.equal(typeof packageJson.scripts.check, "string");
  assert.equal(typeof packageJson.scripts["ci:web"], "string");
  assert.equal(typeof packageJson.scripts["ci:rust"], "string");
  assert.equal(typeof packageJson.scripts.ci, "string");
  assert.ok(packageJson.scripts["lint:ts"].includes("biome check ."));
  assert.ok(packageJson.scripts["lint:rust"].includes("ensure:tauri-icon"));
});

test("tauri config uses pnpm lifecycle commands and project identity", () => {
  assert.equal(tauriConfig.productName, "AI Manager");
  assert.equal(tauriConfig.identifier, "com.thundermiracle.ai-manager");
  assert.equal(tauriConfig.build.beforeDevCommand, "pnpm run pretauri:dev");
  assert.equal(tauriConfig.build.beforeBuildCommand, "pnpm run pretauri:build");
  assert.equal(tauriConfig.build.devUrl, "http://localhost:1420");
});

test("rust crate is configured for edition 2024 and main binary wiring", () => {
  assert.match(cargoToml, /^edition = "2024"$/m);
  assert.match(cargoToml, /^name = "ai-manager"$/m);
  assert.match(cargoToml, /^name = "ai_manager_lib"$/m);
  assert.match(mainRs, /ai_manager_lib::run\(\)/);
});

test("tauri icon generation script exists for clean environments", () => {
  assert.match(iconScript, /src-tauri\/icons\/icon\.png/);
  assert.match(iconScript, /Buffer\.from\(iconBase64, "base64"\)/);
});
