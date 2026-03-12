import type { ResourceRecord } from "../src/backend/contracts.ts";
import {
  findMcpReplicationConflict,
  suggestMcpReplicationTargetId,
} from "../src/features/mcp/mcp-replication.ts";
import { buildMcpPersonalTargetPlan } from "../src/features/mcp/mcp-targets.ts";

function makeResource(overrides: Partial<ResourceRecord>): ResourceRecord {
  return {
    id: "cursor::user::filesystem",
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
    is_effective: true,
    shadowed_by: null,
    description: null,
    install_kind: null,
    manifest_content: null,
    ...overrides,
  };
}

test("findMcpReplicationConflict returns only destination-matching entries", () => {
  const destination = buildMcpPersonalTargetPlan("cursor");
  const resources = [
    makeResource({ logical_id: "filesystem", display_name: "filesystem" }),
    makeResource({
      id: "cursor::project::filesystem",
      source_scope: "project_shared",
      source_label: "Project config",
      source_id: "mcp::cursor::project_shared::/Users/demo/workspace/.cursor/mcp.json::/mcpServers",
      source_path: "/Users/demo/workspace/.cursor/mcp.json",
    }),
  ];

  const conflict = findMcpReplicationConflict(resources, destination, "filesystem");

  expect(conflict?.source_scope).toBe("user");
});

test("suggestMcpReplicationTargetId increments until a free destination id exists", () => {
  const destination = buildMcpPersonalTargetPlan("cursor");
  const resources = [
    makeResource({ logical_id: "filesystem", display_name: "filesystem" }),
    makeResource({
      id: "cursor::user::filesystem-2",
      logical_id: "filesystem-2",
      display_name: "filesystem-2",
    }),
  ];

  expect(suggestMcpReplicationTargetId(resources, destination, "filesystem")).toBe("filesystem-3");
});
