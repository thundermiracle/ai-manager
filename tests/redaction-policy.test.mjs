import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("frontend redaction utility masks sensitive key patterns", async () => {
  const source = await readWorkspaceFile("./src/security/redaction.ts");

  assert.match(source, /SENSITIVE_KEY_PATTERN/);
  assert.match(source, /api\[_-\]\?key/);
  assert.match(source, /KNOWN_TOKEN_REGEX/);
  assert.match(source, /REDACTED_VALUE/);
});

test("ui hooks route messages through redaction helpers", async () => {
  const detections = await readWorkspaceFile("./src/features/clients/useClientDetections.ts");
  const mcp = await readWorkspaceFile("./src/features/mcp/useMcpManager.ts");
  const skills = await readWorkspaceFile("./src/features/skills/useSkillManager.ts");

  assert.match(detections, /commandErrorToDiagnostic/);
  assert.match(detections, /runtimeErrorToDiagnostic/);

  assert.match(mcp, /redactSensitiveText/);
  assert.match(mcp, /redactNullableSensitiveText/);
  assert.match(mcp, /runtimeErrorToDiagnostic/);
  assert.match(mcp, /commandErrorToDiagnostic/);

  assert.match(skills, /redactSensitiveText/);
  assert.match(skills, /redactNullableSensitiveText/);
  assert.match(skills, /runtimeErrorToDiagnostic/);
  assert.match(skills, /commandErrorToDiagnostic/);
});
