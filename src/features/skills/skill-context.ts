import type { ResourceContextMode } from "../resources/resource-context";

export function buildSkillContextHint(contextMode: ResourceContextMode): string {
  if (contextMode === "project") {
    return "This tab manages AI Manager generic skill libraries in personal storage only. Claude native project support is tracked separately as subagents and does not appear in this view.";
  }

  return "This tab manages AI Manager generic skill libraries across the supported clients.";
}
