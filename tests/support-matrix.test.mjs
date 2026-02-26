import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const matrixPath = new URL("../docs/spec/support-matrix.v1.json", import.meta.url);
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));

const expectedClientIds = ["claude_code", "codex_cli", "cursor", "codex_app"];

function assertContiguousPriorities(candidates, fieldName) {
  const priorities = candidates.map((candidate) => candidate.priority).sort((a, b) => a - b);
  const expected = Array.from({ length: priorities.length }, (_, index) => index + 1);
  assert.deepEqual(
    priorities,
    expected,
    `${fieldName} priorities must be contiguous and start from 1`,
  );
}

test("matrix includes exactly four target clients", () => {
  assert.equal(matrix.version, "1.0.0");
  assert.equal(matrix.clients.length, expectedClientIds.length);
  assert.deepEqual(
    matrix.clients.map((client) => client.id).sort(),
    [...expectedClientIds].sort(),
  );
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
