import { buildRouteOverview } from "../src/features/navigation/route-overview.ts";

test("manager routes no longer render route-level overview chrome", () => {
  expect(buildRouteOverview("dashboard")).toBeNull();
  expect(buildRouteOverview("mcp")).toBeNull();
  expect(buildRouteOverview("skills")).toBeNull();
});
