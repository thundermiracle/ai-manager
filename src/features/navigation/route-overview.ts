import type { AppRoute } from "../navigation";

export interface RouteOverviewContent {
  eyebrow: string;
  description: string;
}

export function buildRouteOverview(route: AppRoute): RouteOverviewContent | null {
  switch (route) {
    case "dashboard":
    case "mcp":
    case "skills":
      return null;
  }
}
