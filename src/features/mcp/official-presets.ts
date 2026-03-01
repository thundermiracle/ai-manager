export type McpPresetTransport =
  | {
      mode: "stdio";
      command: string;
      args: string[];
    }
  | {
      mode: "sse";
      url: string;
    };

export interface McpOfficialPreset {
  id: string;
  name: string;
  summary: string;
  sourceLabel: string;
  docsUrl: string;
  targetId: string;
  transport: McpPresetTransport;
  notes: string[];
}

export const MCP_FALLBACK_PRESETS: McpOfficialPreset[] = [
  {
    id: "github",
    name: "GitHub",
    summary: "GitHub API access for repositories, issues, pull requests, and search.",
    sourceLabel: "GitHub Official MCP Server",
    docsUrl: "https://github.com/github/github-mcp-server",
    targetId: "github",
    transport: {
      mode: "stdio",
      command: "docker",
      args: [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server",
      ],
    },
    notes: [
      "Set GITHUB_PERSONAL_ACCESS_TOKEN in the MCP server environment before use.",
      "Reference: github/github-mcp-server official README and host-specific install guide.",
    ],
  },
  {
    id: "chrome-devtools",
    name: "Chrome DevTools",
    summary: "Official Chrome DevTools MCP server for browser automation and debugging.",
    sourceLabel: "ChromeDevTools Official MCP Server",
    docsUrl: "https://github.com/ChromeDevTools/chrome-devtools-mcp/",
    targetId: "chrome-devtools",
    transport: {
      mode: "stdio",
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest"],
    },
    notes: [
      "Optional flags can be added in args, for example --browser-url=http://127.0.0.1:9222.",
      "You can also use flags like --headless=true or --isolated=true based on your workflow.",
    ],
  },
  {
    id: "figma",
    name: "Figma",
    summary: "Official remote MCP endpoint published by Figma.",
    sourceLabel: "MCP Registry + Figma",
    docsUrl: "https://github.com/figma/mcp-server-guide",
    targetId: "figma",
    transport: {
      mode: "sse",
      url: "https://mcp.figma.com/mcp",
    },
    notes: [
      "Some workflows require provider-side auth/session before tool calls succeed.",
      "Endpoint source: registry.modelcontextprotocol.io entry for com.figma.mcp/mcp.",
    ],
  },
  {
    id: "playwright",
    name: "Playwright",
    summary: "Official Playwright MCP server for structured browser automation.",
    sourceLabel: "Microsoft Official MCP Server",
    docsUrl: "https://github.com/microsoft/playwright-mcp",
    targetId: "playwright",
    transport: {
      mode: "stdio",
      command: "npx",
      args: ["@playwright/mcp@latest"],
    },
    notes: [
      "Optional flags can be added in args, such as --browser=chrome or --isolated.",
      "Use --storage-state=<path> or --user-data-dir=<path> when session setup is required.",
    ],
  },
];
