import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("install guide URLs are defined for all supported clients", async () => {
  const source = await readWorkspaceFile("./src/features/clients/client-install-guides.ts");

  assert.match(
    source,
    /claude_code:\s*"https:\/\/docs\.anthropic\.com\/en\/docs\/claude-code\/getting-started"/,
  );
  assert.match(source, /codex_cli:\s*"https:\/\/github\.com\/openai\/codex"/);
  assert.match(source, /cursor:\s*"https:\/\/cursor\.com\/downloads"/);
  assert.match(source, /codex_app:\s*"https:\/\/openai\.com\/codex\/get-started\/"/);
  assert.match(source, /export function getClientInstallGuideUrl/);
});
