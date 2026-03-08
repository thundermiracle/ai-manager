import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMcpCopyDestinationClients,
  buildMcpMutationTargetPlan,
  buildMcpPersonalTargetPlan,
  buildMcpProjectModeHint,
  canPromoteMcpResource,
  describeMcpAction,
  matchesMcpDestination,
} from "../src/features/mcp/mcp-targets.ts";

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
