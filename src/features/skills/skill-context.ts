import type { ResourceContextMode } from "../resources/resource-context";

export function buildSkillContextHint(contextMode: ResourceContextMode): string {
  if (contextMode === "project") {
    return "Project mode currently reuses personal skill storage for the selected client. Project-native skill destinations are not available yet.";
  }

  return "Skills are managed in the selected client's personal storage.";
}

export function describeSkillAction(
  action: "add" | "update" | "remove" | "copy" | "import",
): string {
  switch (action) {
    case "add":
      return "Add personal skill";
    case "update":
      return "Update personal skill";
    case "remove":
      return "Remove from personal";
    case "copy":
      return "Copy to another client";
    case "import":
      return "Import to personal skills";
  }
}
