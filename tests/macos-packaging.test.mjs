import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("package scripts expose macos dmg build entrypoint", async () => {
  const payload = await readWorkspaceFile("./package.json");
  const packageJson = JSON.parse(payload);

  assert.equal(packageJson.scripts["package:macos:dmg"], "node ./scripts/package-macos-dmg.mjs");
});

test("macos packaging script builds dmg and writes manifest", async () => {
  const source = await readWorkspaceFile("./scripts/package-macos-dmg.mjs");

  assert.match(source, /tauri", "build", "--bundles", "dmg"/);
  assert.match(source, /dmg-manifest\.json/);
  assert.match(source, /sha256/);
});

test("macos dmg workflow uses mac runner and uploads artifacts", async () => {
  const workflow = await readWorkspaceFile("./.github/workflows/macos-dmg.yml");

  assert.match(workflow, /runs-on: macos-14/);
  assert.match(workflow, /pnpm run package:macos:dmg/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /ai-manager-macos-dmg-manifest/);
});

test("packaging docs include clean-machine steps and launch check", async () => {
  const docs = await readWorkspaceFile("./docs/release/macos-packaging.md");

  assert.match(docs, /pnpm run package:macos:dmg/);
  assert.match(docs, /dmg-manifest\.json/);
  assert.match(docs, /open \/Applications\/AI\\\\ Manager\.app/);
});
