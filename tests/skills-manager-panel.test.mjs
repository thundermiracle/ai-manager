import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("app shell renders the skills manager route component", async () => {
  const shellSource = await readWorkspaceFile("./src/features/app-shell/AppShell.tsx");

  assert.match(shellSource, /SkillsManagerPanel/);
  assert.match(shellSource, /route === "mcp"/);
});

test("skills manager hook calls list and mutate commands", async () => {
  const hookSource = await readWorkspaceFile("./src/features/skills/useSkillManager.ts");

  assert.match(hookSource, /listResources/);
  assert.match(hookSource, /mutateResource/);
  assert.match(hookSource, /resource_kind: "skill"/);
  assert.match(hookSource, /action: "add"/);
  assert.match(hookSource, /action: "remove"/);
});
