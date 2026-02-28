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
