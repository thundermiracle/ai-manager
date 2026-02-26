import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const modelPath = new URL("../docs/spec/normalized-domain-model.v1.json", import.meta.url);
const model = JSON.parse(readFileSync(modelPath, "utf8"));

const clientTypeSet = new Set(["claude_code", "codex_cli", "cursor", "codex_app"]);
const transportKindSet = new Set(["stdio", "http", "sse", "streamable_http"]);
const skillInstallKindSet = new Set(["file", "directory", "reference"]);

test("domain model envelope version and entity groups are present", () => {
  assert.equal(model.version, "1.0.0");
  assert.ok(model.entities);
  assert.ok(Array.isArray(model.entities.clients));
  assert.ok(Array.isArray(model.entities.mcps));
  assert.ok(Array.isArray(model.entities.skills));
});

test("client entities expose capability flags and extension points", () => {
  for (const client of model.entities.clients) {
    assert.ok(clientTypeSet.has(client.clientType), `unsupported client type: ${client.clientType}`);
    assert.equal(typeof client.capabilities.supportsMcp, "boolean");
    assert.equal(typeof client.capabilities.supportsSkills, "boolean");
    assert.equal(typeof client.capabilities.supportsEnableDisable, "boolean");
    assert.equal(typeof client.extensions, "object");
    assert.equal(typeof client.raw, "object");
  }
});

test("mcp entities include transport model, source metadata and raw payload", () => {
  for (const mcp of model.entities.mcps) {
    assert.ok(transportKindSet.has(mcp.transport.kind), `unsupported transport: ${mcp.transport.kind}`);
    assert.equal(typeof mcp.source.origin, "string");
    assert.equal(typeof mcp.source.path, "string");
    assert.equal(typeof mcp.extensions, "object");
    assert.equal(typeof mcp.raw, "object");
    assert.ok(Array.isArray(mcp.env));
  }
});

test("skill entities include install model, metadata and raw payload", () => {
  for (const skill of model.entities.skills) {
    assert.ok(
      skillInstallKindSet.has(skill.install.kind),
      `unsupported install kind: ${skill.install.kind}`,
    );
    assert.equal(typeof skill.install.path, "string");
    assert.ok(Array.isArray(skill.metadata.tags));
    assert.equal(typeof skill.source.path, "string");
    assert.equal(typeof skill.extensions, "object");
    assert.equal(typeof skill.raw, "object");
  }
});

test("cross-entity references are consistent", () => {
  const clientIds = new Set(model.entities.clients.map((client) => client.id));

  for (const mcp of model.entities.mcps) {
    assert.ok(clientIds.has(mcp.clientId), `mcp references unknown client: ${mcp.clientId}`);
  }

  for (const skill of model.entities.skills) {
    assert.ok(clientIds.has(skill.clientId), `skill references unknown client: ${skill.clientId}`);
  }
});
