import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("operations doc covers all MCP and skills override environment variables", async () => {
  const operationsDoc = await readWorkspaceFile(
    "./docs/operations/config-backup-troubleshooting.md",
  );

  const sources = await Promise.all([
    readWorkspaceFile("./src-tauri/src/detection/clients/claude_code.rs"),
    readWorkspaceFile("./src-tauri/src/detection/clients/codex_cli.rs"),
    readWorkspaceFile("./src-tauri/src/detection/clients/cursor.rs"),
    readWorkspaceFile("./src-tauri/src/detection/clients/codex_app.rs"),
    readWorkspaceFile("./src-tauri/src/application/skill_path_resolver.rs"),
  ]);

  const variables = new Set(
    sources
      .flatMap((source) => source.match(/AI_MANAGER_[A-Z0-9_]+/g) ?? [])
      .filter((name) => name.endsWith("_MCP_CONFIG") || name.endsWith("_SKILLS_DIR")),
  );

  assert.equal(variables.size, 8);

  for (const variable of variables) {
    assert.match(operationsDoc, new RegExp(variable));
  }
});

test("operations doc path mapping matches macOS fallback paths used by code", async () => {
  const operationsDoc = await readWorkspaceFile(
    "./docs/operations/config-backup-troubleshooting.md",
  );
  const expectedPaths = [
    "~/.claude/claude_code_config.json",
    "~/.codex/config.toml",
    "~/.cursor/mcp.json",
    "~/Library/Application Support/Cursor/User/mcp.json",
    "~/Library/Application Support/Codex/mcp.json",
    "~/.config/Codex/mcp.json",
    "~/.claude/skills",
    "~/.codex/skills",
    "~/.cursor/skills",
    "~/Library/Application Support/Cursor/User/skills",
    "~/Library/Application Support/Codex/skills",
    "~/.config/Codex/skills",
  ];

  for (const pathValue of expectedPaths) {
    assert.match(operationsDoc, new RegExp(escapeForRegExp(pathValue)));
  }
});

test("operations doc backup and restore section aligns with mutation implementation", async () => {
  const operationsDoc = await readWorkspaceFile(
    "./docs/operations/config-backup-troubleshooting.md",
  );
  const backupManagerSource = await readWorkspaceFile(
    "./src-tauri/src/infra/mutation/backup_manager.rs",
  );
  const diagnosticsSource = await readWorkspaceFile("./src/features/common/errorDiagnostics.ts");

  assert.match(backupManagerSource, /\.ai-manager-backups/);
  assert.match(backupManagerSource, /\{\}\.\{\}\.bak/);
  assert.match(diagnosticsSource, /Restore if needed: cp/);

  assert.match(operationsDoc, /\.ai-manager-backups/);
  assert.match(operationsDoc, /<filename>\.<timestamp_ms>\.bak/);
  assert.match(operationsDoc, /cp "<backup_path>" "<target_path>"/);
});

test("operations doc includes actionable troubleshooting patterns for current error flows", async () => {
  const operationsDoc = await readWorkspaceFile(
    "./docs/operations/config-backup-troubleshooting.md",
  );

  assert.match(operationsDoc, /\[config_override_missing\]/);
  assert.match(operationsDoc, /\[config_permission_denied\]/);
  assert.match(operationsDoc, /\[binary_missing\]/);
  assert.match(operationsDoc, /Invalid JSON MCP config/);
  assert.match(operationsDoc, /Invalid TOML MCP config/);
  assert.match(operationsDoc, /rollback_succeeded=true/);
});

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
