export type AppRoute = "dashboard" | "mcp" | "skills";

export interface NavigationItem {
  route: AppRoute;
  title: string;
  subtitle: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    route: "dashboard",
    title: "Client Status",
    subtitle: "Detection overview",
  },
  {
    route: "mcp",
    title: "MCP Manager",
    subtitle: "Issue #28 target",
  },
  {
    route: "skills",
    title: "Skills Manager",
    subtitle: "Issue #29 target",
  },
];
