import {
  buildResourceContextSummary,
  isProjectContextIncomplete,
  normalizeProjectRootInput,
} from "../src/features/resources/resource-context.ts";

test("normalizeProjectRootInput trims whitespace and collapses empty values", () => {
  expect(normalizeProjectRootInput("  /Users/demo/project  ")).toBe("/Users/demo/project");
  expect(normalizeProjectRootInput("   ")).toBeNull();
});

test("project context is incomplete only when project mode lacks a root", () => {
  expect(
    isProjectContextIncomplete({
      mode: "project",
      projectRoot: null,
    }),
  ).toBe(true);
  expect(
    isProjectContextIncomplete({
      mode: "project",
      projectRoot: "/Users/demo/project",
    }),
  ).toBe(false);
  expect(
    isProjectContextIncomplete({
      mode: "personal",
      projectRoot: null,
    }),
  ).toBe(false);
});

test("buildResourceContextSummary returns stable user-facing copy", () => {
  expect(
    buildResourceContextSummary({
      mode: "personal",
      projectRoot: null,
    }),
  ).toEqual({
    title: "Personal context",
    description: "Manage personal resources without binding the current view to a project root.",
  });

  expect(
    buildResourceContextSummary({
      mode: "project",
      projectRoot: null,
    }),
  ).toEqual({
    title: "Project context",
    description:
      "Apply a project root to prepare project-aware resource views and destination choices.",
  });

  expect(
    buildResourceContextSummary({
      mode: "project",
      projectRoot: "/Users/demo/project",
    }),
  ).toEqual({
    title: "Project context",
    description: "Project root applied: /Users/demo/project",
  });
});
