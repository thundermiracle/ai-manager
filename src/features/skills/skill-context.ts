import type { ResourceContextMode } from "../resources/resource-context";

export function buildSkillContextHint(contextMode: ResourceContextMode): string {
  if (contextMode === "project") {
    return "This tab manages AI Manager personal skill libraries only. Claude native project support is tracked separately as subagents and does not appear in this view.";
  }

  return "This tab manages AI Manager personal skill libraries for the selected client.";
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
