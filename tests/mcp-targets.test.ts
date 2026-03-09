import assert from "node:assert/strict";
import test from "node:test";

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

  assert.equal(claudeTarget.destinationScope, "project_shared");
  assert.equal(
    claudeTarget.targetSourceId,
    "mcp::claude_code::project_shared::/Users/demo/workspace/.mcp.json::/mcpServers",
  );
  assert.equal(cursorTarget.destinationScope, "project_shared");
  assert.equal(
    cursorTarget.targetSourceId,
    "mcp::cursor::project_shared::/Users/demo/workspace/.cursor/mcp.json::/mcpServers",
  );
});

test("project mode falls back to personal config for Codex", () => {
  const target = buildMcpMutationTargetPlan("codex", "project", "/Users/demo/workspace");

  assert.equal(target.destinationScope, "user");
  assert.equal(target.targetSourceId, null);
  assert.match(target.fallbackNotice ?? "", /falls back to personal config/i);
  assert.equal(describeMcpAction("add", target), "Add to personal config");
});

test("personal target plan stays explicit for promote flows", () => {
  const target = buildMcpPersonalTargetPlan("claude_code");

  assert.equal(target.destinationScope, "user");
  assert.equal(target.projectRoot, null);
  assert.equal(target.targetSourceId, null);
  assert.equal(describeMcpAction("promote", target), "Promote to personal config");
});

test("destination matching prefers client plus destination scope and source id", () => {
  const target = buildMcpMutationTargetPlan("cursor", "project", "/Users/demo/workspace");

  assert.equal(
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
    true,
  );

  assert.equal(
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
    false,
  );
});

test("project mode hint stays explicit about Codex fallback", () => {
  assert.match(buildMcpProjectModeHint(), /Codex falls back to personal config/i);
});

test("promote is available only for project-scoped MCP resources", () => {
  assert.equal(
    canPromoteMcpResource({
      source_scope: "project_shared",
    }),
    true,
  );
  assert.equal(
    canPromoteMcpResource({
      source_scope: "user",
    }),
    false,
  );
});

test("copy destinations exclude the source client", () => {
  assert.deepEqual(buildMcpCopyDestinationClients("cursor"), ["claude_code", "codex"]);
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

  assert.deepEqual(
    selected.map((resource) => resource.id),
    ["cursor::effective", "claude::effective"],
  );
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

  assert.deepEqual(
    selected.map((resource) => resource.id),
    ["alpha::user", "filesystem::project", "filesystem::user"],
  );
});
