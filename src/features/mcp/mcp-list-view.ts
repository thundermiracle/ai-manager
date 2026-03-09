import type { ResourceRecord, ResourceViewMode } from "../../backend/contracts";

export function sortMcpResources(resources: ResourceRecord[]): ResourceRecord[] {
  return [...resources].sort((left, right) => {
    if (left.display_name !== right.display_name) {
      return left.display_name.localeCompare(right.display_name);
    }
    return left.id.localeCompare(right.id);
  });
}

export function selectMcpResourcesForView(
  resources: ResourceRecord[],
  viewMode: ResourceViewMode,
): ResourceRecord[] {
  if (viewMode === "all_sources") {
    return sortMcpResources(resources);
  }

  return sortMcpResources(resources.filter((resource) => resource.is_effective));
}
