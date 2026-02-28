import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("app and navigation do not expose issue number labels in UI text", async () => {
  const shellSource = await readWorkspaceFile("./src/App.tsx");
  const navigationSource = await readWorkspaceFile("./src/features/navigation.ts");

  assert.doesNotMatch(shellSource, /Issue\s*#\d+/);
  assert.doesNotMatch(navigationSource, /Issue\s*#\d+/);
});

test("desktop sidebar uses fixed positioning and mobile layout reverts to static", async () => {
  const shellSource = await readWorkspaceFile("./src/App.tsx");

  assert.match(shellSource, /fixed/);
  assert.match(shellSource, /h-\[calc\(100vh-2rem\)\]/);
  assert.match(shellSource, /max-\[980px\]:static/);
});

test("client status cards render details blocks collapsed by default", async () => {
  const cardSource = await readWorkspaceFile("./src/features/clients/ClientStatusCard.tsx");

  assert.match(cardSource, /<details className="rounded-lg border/);
  assert.match(cardSource, /Show tool details/);
  assert.doesNotMatch(cardSource, /<details[^>]*\sopen(?=[\s>])/);
});
