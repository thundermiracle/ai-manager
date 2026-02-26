import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("release checklist defines blocking gates and evidence", async () => {
  const checklist = await readWorkspaceFile("./docs/release/release-checklist.md");

  assert.match(checklist, /Decision: `go` only if every blocking item/);
  assert.match(checklist, /pnpm run ci/);
  assert.match(checklist, /macOS DMG workflow succeeds/);
  assert.match(checklist, /release-notes-template\.md/);
});

test("versioning policy defines deterministic major/minor/patch rules", async () => {
  const policy = await readWorkspaceFile("./docs/release/versioning-policy.md");

  assert.match(policy, /semantic versioning/);
  assert.match(policy, /Bump `MAJOR`/);
  assert.match(policy, /Bump `MINOR`/);
  assert.match(policy, /Bump `PATCH`/);
  assert.match(policy, /Change Classification Checklist/);
});

test("release notes template includes communication sections", async () => {
  const template = await readWorkspaceFile("./docs/release/release-notes-template.md");

  assert.match(template, /## Summary/);
  assert.match(template, /## Compatibility/);
  assert.match(template, /## Upgrade and Migration Notes/);
  assert.match(template, /## Known Issues/);
  assert.match(template, /dist\/macos\/dmg-manifest\.json/);
});

test("readme indexes release documentation directory", async () => {
  const readme = await readWorkspaceFile("./README.md");

  assert.match(readme, /`docs\/release\/`: Packaging, release checklist, and versioning policy\./);
});
