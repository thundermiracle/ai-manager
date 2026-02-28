import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("app entry hosts shell logic directly in App", async () => {
  const appSource = await readWorkspaceFile("./src/App.tsx");

  assert.match(appSource, /function App\(\)/);
  assert.match(appSource, /useClientDetections/);
  assert.match(appSource, /ClientStatusCard/);
  assert.doesNotMatch(appSource, /AppShell/);
});

test("navigation exposes dashboard, mcp, and skills routes", async () => {
  const navigationSource = await readWorkspaceFile("./src/features/navigation.ts");

  assert.match(navigationSource, /route:\s*"dashboard"/);
  assert.match(navigationSource, /route:\s*"mcp"/);
  assert.match(navigationSource, /route:\s*"skills"/);
});

test("app uses detection hook and state panels", async () => {
  const shellSource = await readWorkspaceFile("./src/App.tsx");

  assert.match(shellSource, /useClientDetections/);
  assert.match(shellSource, /ClientStatusCard/);
  assert.match(shellSource, /ViewStatePanel/);
});

test("dashboard header is rendered only on dashboard route", async () => {
  const shellSource = await readWorkspaceFile("./src/App.tsx");

  assert.match(
    shellSource,
    /\{isDashboardRoute \? \(\s*<>\s*<header[\s\S]*App Shell and Client Dashboard/s,
  );
});
