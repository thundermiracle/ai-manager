import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cursorDetector = readFileSync(
  new URL("../src-tauri/src/detection/clients/cursor.rs", import.meta.url),
  "utf8",
);
const codexAppDetector = readFileSync(
  new URL("../src-tauri/src/detection/clients/codex_app.rs", import.meta.url),
  "utf8",
);
const pathBasedDetector = readFileSync(
  new URL("../src-tauri/src/detection/path_based.rs", import.meta.url),
  "utf8",
);
const probeImplementation = readFileSync(
  new URL("../src-tauri/src/detection/probe.rs", import.meta.url),
  "utf8",
);

test("cursor detector includes app-data fallback candidates", () => {
  assert.match(cursorDetector, /config_override_env_var: "AI_MANAGER_CURSOR_MCP_CONFIG"/);
  assert.match(cursorDetector, /~\/.cursor\/mcp\.json/);
  assert.match(cursorDetector, /Library\/Application Support\/Cursor\/User\/mcp\.json/);
});

test("codex app detector includes app-data fallback candidates", () => {
  assert.match(codexAppDetector, /config_override_env_var: "AI_MANAGER_CODEX_APP_MCP_CONFIG"/);
  assert.match(codexAppDetector, /Library\/Application Support\/Codex\/mcp\.json/);
  assert.match(codexAppDetector, /~\/.config\/Codex\/mcp\.json/);
});

test("desktop detector and probe surface permission failures clearly", () => {
  assert.match(pathBasedDetector, /\[config_permission_denied\]/);
  assert.match(probeImplementation, /OverridePermissionDenied/);
  assert.match(probeImplementation, /PermissionDenied/);
});
