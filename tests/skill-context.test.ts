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
  expect(buildSkillContextHint("project")).toMatch(/generic skill libraries/i);
  expect(buildSkillContextHint("project")).toMatch(/subagents/i);
});

test("personal mode hint stays concise", () => {
  expect(buildSkillContextHint("personal")).toBe(
    "This tab manages AI Manager generic skill libraries across the supported clients.",
  );
});

test("skill action labels stay explicit and can target a client", () => {
  expect(describeSkillAction("add")).toBe("Add personal skill");
  expect(describeSkillAction("update", "cursor")).toBe("Update Cursor personal skill");
  expect(describeSkillAction("remove")).toBe("Remove from personal");
  expect(describeSkillAction("copy")).toBe("Copy to another client");
  expect(describeSkillAction("import", "claude_code")).toBe(
    "Import to Claude Code personal library",
  );
});

test("skill client catalog excludes the source client for copy workflows", () => {
  expect(SKILL_CLIENTS).toEqual(["claude_code", "cursor", "codex"]);
  expect(buildSkillCopyDestinationClients("cursor")).toEqual(["claude_code", "codex"]);
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

  expect(
    filterSkillResources(resources, ["cursor", "codex"], "cursor").map((resource) => resource.id),
  ).toEqual(["cursor::lint"]);
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
  expect(counts.get("claude_code")).toBe(1);
  expect(counts.get("cursor")).toBe(2);
  expect(counts.get("codex")).toBe(0);
  expect(toggleSkillClientFilter(["cursor"], "cursor")).toEqual([]);
});

test("resource kind catalog marks generic and native families explicitly", () => {
  expect(RESOURCE_KIND_CATALOG.skill.family).toBe("generic");
  expect(RESOURCE_KIND_CATALOG.skill.managementModel).toBe("ai_manager");
  expect(RESOURCE_KIND_CATALOG.mcp.family).toBe("native");
  expect(RESOURCE_KIND_CATALOG.subagent.family).toBe("native");
});
