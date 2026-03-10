import assert from "node:assert/strict";
import test from "node:test";

import { buildRouteOverview } from "../src/features/navigation/route-overview.ts";

test("manager routes no longer render route-level overview chrome", () => {
  assert.equal(buildRouteOverview("dashboard"), null);
  assert.equal(buildRouteOverview("mcp"), null);
  assert.equal(buildRouteOverview("skills"), null);
});
