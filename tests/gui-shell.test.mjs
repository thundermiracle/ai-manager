import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("app entry renders the AppShell component", async () => {
  const appSource = await readWorkspaceFile("./src/App.tsx");

  assert.match(appSource, /import\s+\{\s*AppShell\s*\}/);
  assert.match(appSource, /return\s+<AppShell\s*\/>/);
});

test("navigation exposes dashboard, mcp, and skills routes", async () => {
  const navigationSource = await readWorkspaceFile("./src/features/app-shell/navigation.ts");

  assert.match(navigationSource, /route:\s*"dashboard"/);
  assert.match(navigationSource, /route:\s*"mcp"/);
  assert.match(navigationSource, /route:\s*"skills"/);
});

test("app shell uses detection hook and client status cards", async () => {
  const shellSource = await readWorkspaceFile("./src/features/app-shell/AppShell.tsx");

  assert.match(shellSource, /useClientDetections/);
  assert.match(shellSource, /ClientStatusCard/);
  assert.match(shellSource, /ViewStatePanel/);
});
