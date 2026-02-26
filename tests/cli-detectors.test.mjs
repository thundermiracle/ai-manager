import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const claudeDetector = readFileSync(
  new URL("../src-tauri/src/detection/clients/claude_code.rs", import.meta.url),
  "utf8",
);
const codexCliDetector = readFileSync(
  new URL("../src-tauri/src/detection/clients/codex_cli.rs", import.meta.url),
  "utf8",
);
const pathBasedDetector = readFileSync(
  new URL("../src-tauri/src/detection/path_based.rs", import.meta.url),
  "utf8",
);

test("claude code detector uses deterministic binary and config candidate order", () => {
  assert.match(claudeDetector, /binary_candidates: &\["claude", "claude-code"\]/);
  assert.match(claudeDetector, /config_override_env_var: "AI_MANAGER_CLAUDE_CODE_MCP_CONFIG"/);
  assert.match(
    claudeDetector,
    /config_fallback_paths: &\["~\/.claude\/claude_code_config\.json"\]/,
  );
});

test("codex cli detector uses deterministic binary and config candidate order", () => {
  assert.match(codexCliDetector, /binary_candidates: &\["codex", "codex-cli"\]/);
  assert.match(codexCliDetector, /config_override_env_var: "AI_MANAGER_CODEX_CLI_MCP_CONFIG"/);
  assert.match(codexCliDetector, /config_fallback_paths: &\["~\/.codex\/config\.toml"\]/);
});

test("cli detector reason codes distinguish missing binary vs missing config", () => {
  assert.match(pathBasedDetector, /\[config_missing\]/);
  assert.match(pathBasedDetector, /\[binary_missing\]/);
  assert.match(pathBasedDetector, /\[binary_and_config_missing\]/);
  assert.match(pathBasedDetector, /\[config_override_missing\]/);
});
