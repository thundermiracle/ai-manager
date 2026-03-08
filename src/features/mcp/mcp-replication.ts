import type { ResourceRecord } from "../../backend/contracts";

import type { McpMutationTargetPlan } from "./mcp-targets";
import { matchesMcpDestination } from "./mcp-targets";

export function findMcpReplicationConflict(
  resources: ResourceRecord[],
  destination: McpMutationTargetPlan,
  targetId: string,
): ResourceRecord | null {
  const normalizedTargetId = targetId.trim().toLowerCase();
  if (normalizedTargetId.length === 0) {
    return null;
  }

  return (
    resources.find(
      (resource) =>
        matchesMcpDestination(resource, destination) &&
        resource.logical_id.trim().toLowerCase() === normalizedTargetId,
    ) ?? null
  );
}

export function suggestMcpReplicationTargetId(
  resources: ResourceRecord[],
  destination: McpMutationTargetPlan,
  targetId: string,
): string {
  const normalizedTargetId = targetId.trim();
  const base = normalizedTargetId.length > 0 ? normalizedTargetId : "mcp-copy";
  const reserved = new Set(
    resources
      .filter((resource) => matchesMcpDestination(resource, destination))
      .map((resource) => resource.logical_id.trim().toLowerCase()),
  );

  if (!reserved.has(base.toLowerCase())) {
    return base;
  }

  let suffix = 2;
  while (reserved.has(`${base}-${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}
