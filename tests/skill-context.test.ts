import assert from "node:assert/strict";
import test from "node:test";

import type { ResourceRecord } from "../src/backend/contracts.ts";
import { RESOURCE_KIND_CATALOG } from "../src/backend/contracts.ts";
import { buildSkillContextHint } from "../src/features/skills/skill-context.ts";
import {
  countSkillResourcesByClient,
  filterSkillResources,
  toggleSkillClientFilter,
} from "../src/features/skills/skill-list-view.ts";
import {
  buildSkillCopyDestinationClients,
  describeSkillAction,
  SKILL_CLIENTS,
} from "../src/features/skills/skill-targets.ts";

function createSkillResource(
  overrides: Partial<ResourceRecord> &
    Pick<ResourceRecord, "id" | "client" | "display_name" | "install_kind">,
): ResourceRecord {
  return {
    id: overrides.id,
    logical_id: overrides.logical_id ?? overrides.display_name,
    client: overrides.client,
    display_name: overrides.display_name,
    enabled: overrides.enabled ?? true,
    transport_kind: null,
    transport_command: null,
    transport_args: null,
    transport_url: null,
    source_path: overrides.source_path ?? null,
    source_id: overrides.source_id ?? `${overrides.client}::skills`,
    source_scope: overrides.source_scope ?? "user",
    source_label: overrides.source_label ?? "Personal skills directory",
    is_effective: overrides.is_effective ?? true,
    shadowed_by: overrides.shadowed_by ?? null,
    description: overrides.description ?? null,
    install_kind: overrides.install_kind,
    manifest_content: overrides.manifest_content ?? null,
  };
}

test("project mode hint stays explicit about personal-only skill storage", () => {
  assert.match(buildSkillContextHint("project"), /generic skill libraries/i);
  assert.match(buildSkillContextHint("project"), /subagents/i);
});

test("personal mode hint stays concise", () => {
  assert.equal(
    buildSkillContextHint("personal"),
    "This tab manages AI Manager generic skill libraries across the supported clients.",
  );
});

test("skill action labels stay explicit and can target a client", () => {
  assert.equal(describeSkillAction("add"), "Add personal skill");
  assert.equal(describeSkillAction("update", "cursor"), "Update Cursor personal skill");
  assert.equal(describeSkillAction("remove"), "Remove from personal");
  assert.equal(describeSkillAction("copy"), "Copy to another client");
  assert.equal(
    describeSkillAction("import", "claude_code"),
    "Import to Claude Code personal library",
  );
});

test("skill client catalog excludes the source client for copy workflows", () => {
  assert.deepEqual(SKILL_CLIENTS, ["claude_code", "cursor", "codex"]);
  assert.deepEqual(buildSkillCopyDestinationClients("cursor"), ["claude_code", "codex"]);
});

test("skill list view filters by client and search query", () => {
  const resources = [
    createSkillResource({
      id: "claude::writer",
      client: "claude_code",
      display_name: "writer",
      install_kind: "directory",
    }),
    createSkillResource({
      id: "cursor::lint",
      client: "cursor",
      display_name: "lint-helper",
      install_kind: "file",
    }),
    createSkillResource({
      id: "codex::tests",
      client: "codex",
      display_name: "test-runner",
      install_kind: "directory",
    }),
  ];

  assert.deepEqual(
    filterSkillResources(resources, ["cursor", "codex"], "cursor").map((resource) => resource.id),
    ["cursor::lint"],
  );
});

test("skill list view counts resources per client and allows clearing every filter", () => {
  const resources = [
    createSkillResource({
      id: "claude::writer",
      client: "claude_code",
      display_name: "writer",
      install_kind: "directory",
    }),
    createSkillResource({
      id: "cursor::lint",
      client: "cursor",
      display_name: "lint-helper",
      install_kind: "file",
    }),
    createSkillResource({
      id: "cursor::review",
      client: "cursor",
      display_name: "review-helper",
      install_kind: "directory",
    }),
  ];

  const counts = countSkillResourcesByClient(resources);
  assert.equal(counts.get("claude_code"), 1);
  assert.equal(counts.get("cursor"), 2);
  assert.equal(counts.get("codex"), 0);
  assert.deepEqual(toggleSkillClientFilter(["cursor"], "cursor"), []);
});

test("resource kind catalog marks generic and native families explicitly", () => {
  assert.equal(RESOURCE_KIND_CATALOG.skill.family, "generic");
  assert.equal(RESOURCE_KIND_CATALOG.skill.managementModel, "ai_manager");
  assert.equal(RESOURCE_KIND_CATALOG.mcp.family, "native");
  assert.equal(RESOURCE_KIND_CATALOG.subagent.family, "native");
});
