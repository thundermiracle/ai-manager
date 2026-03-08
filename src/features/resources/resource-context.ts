export type ResourceContextMode = "personal" | "project";

export interface ResourceContextState {
  mode: ResourceContextMode;
  projectRoot: string | null;
}

export interface ResourceContextSummary {
  title: string;
  description: string;
}

export function normalizeProjectRootInput(value: string): string | null {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export function isProjectContextIncomplete(context: ResourceContextState): boolean {
  return context.mode === "project" && context.projectRoot === null;
}

export function buildResourceContextSummary(context: ResourceContextState): ResourceContextSummary {
  if (context.mode === "personal") {
    return {
      title: "Personal context",
      description: "Manage personal resources without binding the current view to a project root.",
    };
  }

  if (context.projectRoot === null) {
    return {
      title: "Project context",
      description:
        "Apply a project root to prepare project-aware resource views and destination choices.",
    };
  }

  return {
    title: "Project context",
    description: `Project root applied: ${context.projectRoot}`,
  };
}
