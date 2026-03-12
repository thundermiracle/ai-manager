import type { ResourceRecord } from "../src/backend/contracts.ts";
import { selectMcpResourcesForView } from "../src/features/mcp/mcp-list-view.ts";
import {
  buildMcpCopyDestinationClients,
  buildMcpMutationTargetPlan,
  buildMcpPersonalTargetPlan,
  buildMcpProjectModeHint,
  canPromoteMcpResource,
  describeMcpAction,
  matchesMcpDestination,
} from "../src/features/mcp/mcp-targets.ts";

function createMcpResource(
  overrides: Partial<ResourceRecord> & Pick<ResourceRecord, "id" | "display_name" | "is_effective">,
): ResourceRecord {
  return {
    id: overrides.id,
    logical_id: overrides.logical_id ?? overrides.display_name,
    client: overrides.client ?? "claude_code",
    display_name: overrides.display_name,
    enabled: overrides.enabled ?? true,
    transport_kind: overrides.transport_kind ?? "stdio",
    transport_command: overrides.transport_command ?? "npx",
    transport_args: overrides.transport_args ?? [],
    transport_url: overrides.transport_url ?? null,
    source_path: overrides.source_path ?? null,
    source_id: overrides.source_id ?? `${overrides.id}::source`,
    source_scope: overrides.source_scope ?? "user",
    source_label: overrides.source_label ?? "Personal config",
    is_effective: overrides.is_effective,
    shadowed_by: overrides.shadowed_by ?? null,
    description: overrides.description ?? null,
    install_kind: overrides.install_kind ?? null,
    manifest_content: overrides.manifest_content ?? null,
  };
}

test("project mode targets shared project config for Claude Code and Cursor", () => {
  const claudeTarget = buildMcpMutationTargetPlan(
    "claude_code",
    "project",
    "/Users/demo/workspace",
  );
  const cursorTarget = buildMcpMutationTargetPlan("cursor", "project", "/Users/demo/workspace");

  expect(claudeTarget.destinationScope).toBe("project_shared");
  expect(claudeTarget.targetSourceId).toBe(
    "mcp::claude_code::project_shared::/Users/demo/workspace/.mcp.json::/mcpServers",
  );
  expect(cursorTarget.destinationScope).toBe("project_shared");
  expect(cursorTarget.targetSourceId).toBe(
    "mcp::cursor::project_shared::/Users/demo/workspace/.cursor/mcp.json::/mcpServers",
  );
});

test("project mode falls back to personal config for Codex", () => {
  const target = buildMcpMutationTargetPlan("codex", "project", "/Users/demo/workspace");

  expect(target.destinationScope).toBe("user");
  expect(target.targetSourceId).toBeNull();
  expect(target.fallbackNotice ?? "").toMatch(/falls back to personal config/i);
  expect(describeMcpAction("add", target)).toBe("Add to personal config");
});

test("personal target plan stays explicit for promote flows", () => {
  const target = buildMcpPersonalTargetPlan("claude_code");

  expect(target.destinationScope).toBe("user");
  expect(target.projectRoot).toBeNull();
  expect(target.targetSourceId).toBeNull();
  expect(describeMcpAction("promote", target)).toBe("Promote to personal config");
});

test("destination matching prefers client plus destination scope and source id", () => {
  const target = buildMcpMutationTargetPlan("cursor", "project", "/Users/demo/workspace");

  expect(
    matchesMcpDestination(
      {
        id: "cursor::project",
        logical_id: "filesystem",
        client: "cursor",
        display_name: "filesystem",
        enabled: true,
        transport_kind: "stdio",
        transport_command: "npx",
        transport_args: [],
        transport_url: null,
        source_path: "/Users/demo/workspace/.cursor/mcp.json",
        source_id:
          "mcp::cursor::project_shared::/Users/demo/workspace/.cursor/mcp.json::/mcpServers",
        source_scope: "project_shared",
        source_label: "Project config",
        is_effective: true,
        shadowed_by: null,
        description: null,
        install_kind: null,
        manifest_content: null,
      },
      target,
    ),
  ).toBe(true);

  expect(
    matchesMcpDestination(
      {
        id: "cursor::user",
        logical_id: "filesystem",
        client: "cursor",
        display_name: "filesystem",
        enabled: true,
        transport_kind: "stdio",
        transport_command: "npx",
        transport_args: [],
        transport_url: null,
        source_path: "/Users/demo/.cursor/mcp.json",
        source_id: "mcp::cursor::user::/Users/demo/.cursor/mcp.json::/mcpServers",
        source_scope: "user",
        source_label: "Personal config",
        is_effective: false,
        shadowed_by: "cursor::project",
        description: null,
        install_kind: null,
        manifest_content: null,
      },
      target,
    ),
  ).toBe(false);
});

test("project mode hint stays explicit about Codex fallback", () => {
  expect(buildMcpProjectModeHint()).toMatch(/Codex falls back to personal config/i);
});

test("promote is available only for project-scoped MCP resources", () => {
  expect(
    canPromoteMcpResource({
      source_scope: "project_shared",
    }),
  ).toBe(true);
  expect(
    canPromoteMcpResource({
      source_scope: "user",
    }),
  ).toBe(false);
});

test("copy destinations exclude the source client", () => {
  expect(buildMcpCopyDestinationClients("cursor")).toEqual(["claude_code", "codex"]);
});

test("effective view is derived from all sources without shadowed entries", () => {
  const selected = selectMcpResourcesForView(
    [
      createMcpResource({
        id: "cursor::shadowed",
        display_name: "filesystem",
        client: "cursor",
        source_scope: "user",
        is_effective: false,
      }),
      createMcpResource({
        id: "claude::effective",
        display_name: "sequential-thinking",
        client: "claude_code",
        is_effective: true,
      }),
      createMcpResource({
        id: "cursor::effective",
        display_name: "filesystem",
        client: "cursor",
        source_scope: "project_shared",
        is_effective: true,
      }),
    ],
    "effective",
  );

  expect(selected.map((resource) => resource.id)).toEqual([
    "cursor::effective",
    "claude::effective",
  ]);
});

test("all sources view preserves every source and sorts deterministically", () => {
  const selected = selectMcpResourcesForView(
    [
      createMcpResource({
        id: "filesystem::project",
        display_name: "filesystem",
        source_scope: "project_shared",
        is_effective: true,
      }),
      createMcpResource({
        id: "alpha::user",
        display_name: "alpha",
        is_effective: true,
      }),
      createMcpResource({
        id: "filesystem::user",
        display_name: "filesystem",
        source_scope: "user",
        is_effective: false,
      }),
    ],
    "all_sources",
  );

  expect(selected.map((resource) => resource.id)).toEqual([
    "alpha::user",
    "filesystem::project",
    "filesystem::user",
  ]);
});
