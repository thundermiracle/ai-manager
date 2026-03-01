import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("error diagnostics include recoverability and backup guidance hooks", async () => {
  const source = await readWorkspaceFile("./src/features/common/errorDiagnostics.ts");

  assert.match(source, /recoverable/);
  assert.match(source, /Backup:\\s\\*/);
  assert.match(source, /INTERNAL_ERROR/);
  assert.match(source, /SHUTTING_DOWN/);
});

test("mcp and skills panels keep list recovery callouts and route mutation errors to snackbar", async () => {
  const mcp = await readWorkspaceFile("./src/features/mcp/McpManagerPanel.tsx");
  const skills = await readWorkspaceFile("./src/features/skills/SkillsManagerPanel.tsx");

  assert.match(mcp, /ErrorRecoveryCallout/);
  assert.match(mcp, /MCP list operation failed/);
  assert.doesNotMatch(mcp, /MCP mutation failed/);
  assert.match(mcp, /feedback\.kind === "error" && feedback\.diagnostic/);
  assert.match(mcp, /CODE: \$\{feedback\.diagnostic\.code\}/);
  assert.match(mcp, /Snackbar/);

  assert.match(skills, /ErrorRecoveryCallout/);
  assert.match(skills, /Skills list operation failed/);
  assert.doesNotMatch(skills, /Skill mutation failed/);
  assert.match(skills, /feedback\.kind === "error" && feedback\.diagnostic/);
  assert.match(skills, /CODE: \$\{feedback\.diagnostic\.code\}/);
  assert.match(skills, /Snackbar/);
});

test("app uses recovery callout for detection failures", async () => {
  const shell = await readWorkspaceFile("./src/App.tsx");

  assert.match(shell, /ErrorRecoveryCallout/);
  assert.match(shell, /diagnostic=\{errorDiagnostic\}/);
  assert.match(shell, /Retry Detection/);
});
