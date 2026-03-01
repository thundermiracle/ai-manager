import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("slide over panel uses constrained internal scroll container", async () => {
  const source = await readWorkspaceFile("./src/components/shared/SlideOverPanel.tsx");

  assert.match(source, /flex h-full min-h-0 w-full max-w-\[28\.5rem\] flex-col/);
  assert.match(source, /min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto/);
});
