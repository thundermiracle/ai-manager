import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("snackbar uses smooth enter/exit animation", async () => {
  const source = await readWorkspaceFile("./src/components/shared/Snackbar.tsx");

  assert.match(source, /transition duration-200 ease-out/);
  assert.match(source, /translate-y-2 scale-\[0\.98\] opacity-0/);
});

test("snackbar renders radial countdown linked to duration", async () => {
  const source = await readWorkspaceFile("./src/components/shared/Snackbar.tsx");

  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /strokeDasharray=\{COUNTDOWN_CIRCUMFERENCE\}/);
  assert.match(source, /strokeDashoffset=\{countdownOffset\}/);
  assert.match(source, /window\.setTimeout\(\(\) => \{\s*onCloseRef\.current\(\);/s);
});
