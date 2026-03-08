import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const matrixPath = new URL("../docs/spec/support-matrix.v1.json", import.meta.url);
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));

const expectedClientIds = ["claude_code", "codex", "cursor"];
const sourceScopeSet = new Set(["user", "project_shared", "project_private"]);

function assertContiguousPriorities(candidates, fieldName) {
  const priorities = candidates.map((candidate) => candidate.priority).sort((a, b) => a - b);
  const expected = Array.from({ length: priorities.length }, (_, index) => index + 1);
  assert.deepEqual(
    priorities,
    expected,
    `${fieldName} priorities must be contiguous and start from 1`,
  );
}

test("matrix includes exactly three target clients", () => {
  assert.equal(matrix.version, "1.3.0");
  assert.equal(matrix.clients.length, expectedClientIds.length);
  assert.deepEqual(matrix.clients.map((client) => client.id).sort(), [...expectedClientIds].sort());
});

test("each client has deterministic candidate priority order per kind", () => {
  for (const client of matrix.clients) {
    const mcpCandidates = client.configPathCandidates.filter(
      (candidate) => candidate.kind === "mcp_config",
    );
    const skillsCandidates = client.configPathCandidates.filter(
      (candidate) => candidate.kind === "skills_dir",
    );

    assert.ok(mcpCandidates.length > 0, `${client.id} must declare mcp_config candidates`);
    assert.ok(skillsCandidates.length > 0, `${client.id} must declare skills_dir candidates`);

    assertContiguousPriorities(mcpCandidates, `${client.id}/mcp_config`);
    assertContiguousPriorities(skillsCandidates, `${client.id}/skills_dir`);
  }
});

test("every client includes happy_path and fallback candidates", () => {
  for (const client of matrix.clients) {
    const candidateRoles = new Set(client.configPathCandidates.map((candidate) => candidate.role));
    assert.ok(candidateRoles.has("happy_path"), `${client.id} missing happy_path`);
    assert.ok(candidateRoles.has("fallback"), `${client.id} missing fallback`);
  }
});

test("detection requirements are actionable and include config readability", () => {
  for (const client of matrix.clients) {
    assert.ok(
      client.detectionEvidenceRequirements.includes("mcp_config_readable"),
      `${client.id} must require mcp_config_readable`,
    );
    assert.ok(
      client.detectionEvidenceRequirements.length >= 2,
      `${client.id} must have at least two detection requirements`,
    );
  }
});

test("resource kinds expose staged scope support and precedence", () => {
  for (const client of matrix.clients) {
    for (const kind of ["mcp", "skills", "subagents"]) {
      const support = client.resourceKinds[kind];
      assert.ok(Array.isArray(support.currentSourceScopes));
      assert.ok(Array.isArray(support.targetSourceScopes));
      assert.ok(Array.isArray(support.currentDestinationScopes));
      assert.ok(Array.isArray(support.targetDestinationScopes));
      assert.ok(Array.isArray(support.effectivePrecedence));
      assert.ok(Array.isArray(support.notes));

      for (const scope of support.targetSourceScopes) {
        assert.ok(sourceScopeSet.has(scope), `unsupported ${client.id}/${kind} scope: ${scope}`);
      }

      if (support.effectivePrecedence.length > 0) {
        assert.ok(
          support.targetSourceScopes.includes(support.effectivePrecedence[0]),
          `${client.id}/${kind} precedence must start with a supported scope`,
        );
      }
      assert.ok(
        support.currentSourceScopes.every((scope) => support.targetSourceScopes.includes(scope)),
        `${client.id}/${kind} current scopes must be a subset of target scopes`,
      );
    }
  }
});

test("staged MCP support matches the client rollout plan", () => {
  const byId = new Map(matrix.clients.map((client) => [client.id, client]));

  assert.deepEqual(byId.get("claude_code").resourceKinds.mcp.targetSourceScopes, [
    "user",
    "project_shared",
    "project_private",
  ]);
  assert.equal(byId.get("claude_code").resourceKinds.mcp.projectScopeStatus, "planned");

  assert.deepEqual(byId.get("cursor").resourceKinds.mcp.targetSourceScopes, [
    "user",
    "project_shared",
  ]);
  assert.equal(byId.get("cursor").resourceKinds.mcp.projectScopeStatus, "planned");

  assert.deepEqual(byId.get("codex").resourceKinds.mcp.targetSourceScopes, ["user"]);
  assert.equal(byId.get("codex").resourceKinds.mcp.projectScopeStatus, "not_applicable");
});

test("skills notes distinguish generic repositories from native client features", () => {
  const byId = new Map(matrix.clients.map((client) => [client.id, client]));

  for (const client of matrix.clients) {
    const joinedNotes = client.resourceKinds.skills.notes.join(" ");
    assert.match(joinedNotes, /generic/i);
  }

  assert.match(byId.get("claude_code").resourceKinds.skills.notes.join(" "), /subagents|agents/i);
});

test("subagents are modeled as a dedicated Claude-native resource kind", () => {
  const byId = new Map(matrix.clients.map((client) => [client.id, client]));

  assert.deepEqual(byId.get("claude_code").resourceKinds.subagents.currentSourceScopes, [
    "user",
    "project_shared",
  ]);
  assert.deepEqual(byId.get("claude_code").resourceKinds.subagents.targetDestinationScopes, [
    "user",
    "project_shared",
  ]);
  assert.deepEqual(byId.get("claude_code").resourceKinds.subagents.effectivePrecedence, [
    "project_shared",
    "user",
  ]);

  for (const clientId of ["codex", "cursor"]) {
    assert.deepEqual(byId.get(clientId).resourceKinds.subagents.currentSourceScopes, []);
    assert.deepEqual(byId.get(clientId).resourceKinds.subagents.targetSourceScopes, []);
    assert.deepEqual(byId.get(clientId).resourceKinds.subagents.effectivePrecedence, []);
  }
});
