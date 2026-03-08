import type {
  ClientKind,
  ResourceRecord,
  ResourceSourceScope,
  ResourceViewMode,
} from "../../backend/contracts";
import { formatClientLabel } from "../clients/client-labels";
import type { ResourceContextMode } from "../resources/resource-context";

export interface McpMutationTargetPlan {
  client: ClientKind;
  destinationScope: ResourceSourceScope;
  projectRoot: string | null;
  targetSourceId: string | null;
  destinationLabel: string;
  destinationDescription: string;
  fallbackNotice: string | null;
}

export const MCP_CLIENTS: ClientKind[] = ["claude_code", "cursor", "codex"];
export type McpReplicationAction = "copy" | "promote";

const PROJECT_SHARED_CONFIG: Record<
  Exclude<ClientKind, "codex">,
  {
    relativePath: string;
    selector: string;
  }
> = {
  claude_code: {
    relativePath: ".mcp.json",
    selector: "/mcpServers",
  },
  cursor: {
    relativePath: ".cursor/mcp.json",
    selector: "/mcpServers",
  },
};

export function formatResourceViewModeLabel(viewMode: ResourceViewMode): string {
  return viewMode === "effective" ? "Effective Only" : "All Sources";
}

export function buildMcpProjectModeHint(): string {
  return "Project mode writes new MCP entries to project config for Claude Code and Cursor. Codex falls back to personal config because it does not support project MCP sources yet.";
}

export function supportsProjectScopedMcp(client: ClientKind): boolean {
  return client !== "codex";
}

export function canPromoteMcpResource(resource: Pick<ResourceRecord, "source_scope">): boolean {
  return resource.source_scope !== "user";
}

export function buildMcpCopyDestinationClients(sourceClient: ClientKind): ClientKind[] {
  return MCP_CLIENTS.filter((client) => client !== sourceClient);
}

export function buildMcpPersonalTargetPlan(client: ClientKind): McpMutationTargetPlan {
  return {
    client,
    destinationScope: "user",
    projectRoot: null,
    targetSourceId: null,
    destinationLabel: "Personal config",
    destinationDescription: `${formatClientLabel(client)} will use personal MCP config.`,
    fallbackNotice: null,
  };
}

export function buildMcpMutationTargetPlan(
  client: ClientKind,
  contextMode: ResourceContextMode,
  projectRoot: string | null,
): McpMutationTargetPlan {
  if (
    contextMode === "project" &&
    projectRoot !== null &&
    (client === "claude_code" || client === "cursor")
  ) {
    const config = PROJECT_SHARED_CONFIG[client];
    return {
      client,
      destinationScope: "project_shared",
      projectRoot,
      targetSourceId: `mcp::${client}::project_shared::${joinPath(
        projectRoot,
        config.relativePath,
      )}::${config.selector}`,
      destinationLabel: "Project config",
      destinationDescription: `${formatClientLabel(client)} writes project MCP entries to ${config.relativePath}.`,
      fallbackNotice: null,
    };
  }

  return {
    client,
    destinationScope: "user",
    projectRoot: contextMode === "project" ? projectRoot : null,
    targetSourceId: null,
    destinationLabel: "Personal config",
    destinationDescription:
      contextMode === "project"
        ? `${formatClientLabel(client)} will use personal MCP config in project mode.`
        : `${formatClientLabel(client)} will use personal MCP config.`,
    fallbackNotice:
      contextMode === "project" && !supportsProjectScopedMcp(client)
        ? `${formatClientLabel(client)} falls back to personal config in project mode.`
        : null,
  };
}

export function buildMcpReplicationTargetPlan(
  action: McpReplicationAction,
  client: ClientKind,
  contextMode: ResourceContextMode,
  projectRoot: string | null,
): McpMutationTargetPlan {
  return action === "promote"
    ? buildMcpPersonalTargetPlan(client)
    : buildMcpMutationTargetPlan(client, contextMode, projectRoot);
}

export function matchesMcpDestination(
  resource: ResourceRecord,
  destination: McpMutationTargetPlan,
): boolean {
  if (resource.client !== destination.client) {
    return false;
  }

  if (resource.source_scope !== destination.destinationScope) {
    return false;
  }

  if (destination.targetSourceId === null) {
    return true;
  }

  return resource.source_id === destination.targetSourceId;
}

export function describeMcpAction(
  action: "add" | McpReplicationAction,
  destination: McpMutationTargetPlan,
): string {
  if (action === "add") {
    return destination.destinationScope === "project_shared"
      ? "Add to project config"
      : "Add to personal config";
  }

  if (action === "promote") {
    return "Promote to personal config";
  }

  return destination.destinationScope === "project_shared"
    ? `Copy to ${formatClientLabel(destination.client)} project config`
    : `Copy to ${formatClientLabel(destination.client)} personal config`;
}

function joinPath(root: string, relativePath: string): string {
  const normalizedRoot = root.endsWith("/") ? root.slice(0, -1) : root;
  return `${normalizedRoot}/${relativePath}`;
}
