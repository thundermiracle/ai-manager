import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("app renders the MCP manager route component", async () => {
  const shellSource = await readWorkspaceFile("./src/App.tsx");

  assert.match(shellSource, /McpManagerPanel/);
  assert.match(shellSource, /route === "mcp"/);
});

test("mcp manager hook calls list and mutate commands", async () => {
  const hookSource = await readWorkspaceFile("./src/features/mcp/useMcpManager.ts");

  assert.match(hookSource, /listResources/);
  assert.match(hookSource, /mutateResource/);
  assert.match(hookSource, /action: "add"/);
  assert.match(hookSource, /action: "remove"/);
});

test("mcp manager remove action uses in-app confirmation modal", async () => {
  const panelSource = await readWorkspaceFile("./src/features/mcp/McpManagerPanel.tsx");

  assert.match(panelSource, /ConfirmModal/);
  assert.match(panelSource, /Remove MCP Entry/);
  assert.doesNotMatch(panelSource, /window\.confirm/);
});

test("mcp manager uses snackbar for transient feedback", async () => {
  const panelSource = await readWorkspaceFile("./src/features/mcp/McpManagerPanel.tsx");

  assert.match(panelSource, /Snackbar/);
  assert.match(panelSource, /durationMs=\{5000\}/);
  assert.doesNotMatch(panelSource, /feedback\?\.kind === "success"[\s\S]*<Alert/s);
});
