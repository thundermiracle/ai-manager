import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import { formatClientLabel } from "../clients/client-labels";
import { SKILL_CLIENTS } from "./skill-targets";

export function sortSkillResources(resources: ResourceRecord[]): ResourceRecord[] {
  return [...resources].sort((left, right) => {
    if (left.display_name !== right.display_name) {
      return left.display_name.localeCompare(right.display_name);
    }

    return left.id.localeCompare(right.id);
  });
}

export function toggleSkillClientFilter(current: ClientKind[], client: ClientKind): ClientKind[] {
  if (current.includes(client)) {
    return current.length === 1 ? current : current.filter((entry) => entry !== client);
  }

  return [...current, client];
}

export function countSkillResourcesByClient(resources: ResourceRecord[]): Map<ClientKind, number> {
  const counts = new Map<ClientKind, number>(SKILL_CLIENTS.map((client) => [client, 0]));

  for (const resource of resources) {
    counts.set(resource.client, (counts.get(resource.client) ?? 0) + 1);
  }

  return counts;
}

export function filterSkillResources(
  resources: ResourceRecord[],
  clientFilters: ClientKind[],
  searchQuery: string,
): ResourceRecord[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return sortSkillResources(
    resources.filter((resource) => {
      if (!clientFilters.includes(resource.client)) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      const haystack = [
        formatClientLabel(resource.client),
        resource.display_name,
        resource.install_kind,
        resource.source_label,
        resource.source_path,
        resource.id,
      ]
        .filter((value): value is string => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    }),
  );
}
