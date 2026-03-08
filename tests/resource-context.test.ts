import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResourceContextSummary,
  isProjectContextIncomplete,
  normalizeProjectRootInput,
} from "../src/features/resources/resource-context.ts";

test("normalizeProjectRootInput trims whitespace and collapses empty values", () => {
  assert.equal(normalizeProjectRootInput("  /Users/demo/project  "), "/Users/demo/project");
  assert.equal(normalizeProjectRootInput("   "), null);
});

test("project context is incomplete only when project mode lacks a root", () => {
  assert.equal(
    isProjectContextIncomplete({
      mode: "project",
      projectRoot: null,
    }),
    true,
  );
  assert.equal(
    isProjectContextIncomplete({
      mode: "project",
      projectRoot: "/Users/demo/project",
    }),
    false,
  );
  assert.equal(
    isProjectContextIncomplete({
      mode: "personal",
      projectRoot: null,
    }),
    false,
  );
});

test("buildResourceContextSummary returns stable user-facing copy", () => {
  assert.deepEqual(
    buildResourceContextSummary({
      mode: "personal",
      projectRoot: null,
    }),
    {
      title: "Personal context",
      description: "Manage personal resources without binding the current view to a project root.",
    },
  );

  assert.deepEqual(
    buildResourceContextSummary({
      mode: "project",
      projectRoot: null,
    }),
    {
      title: "Project context",
      description:
        "Apply a project root to prepare project-aware resource views and destination choices.",
    },
  );

  assert.deepEqual(
    buildResourceContextSummary({
      mode: "project",
      projectRoot: "/Users/demo/project",
    }),
    {
      title: "Project context",
      description: "Project root applied: /Users/demo/project",
    },
  );
});
