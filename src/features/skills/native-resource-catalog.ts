import type { ClientKind } from "../../backend/contracts";

export interface NativeResourceEntryPoint {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
}

const CLAUDE_NATIVE_ENTRY_POINTS: NativeResourceEntryPoint[] = [
  {
    id: "claude-subagents",
    title: "Claude Subagents",
    description:
      "Native Claude agent manifests live under ~/.claude/agents and project .claude/agents directories. They stay separate from generic SKILL.md libraries.",
    statusLabel: "Dedicated surface planned",
  },
];

export function listNativeResourceEntryPoints(client: ClientKind): NativeResourceEntryPoint[] {
  if (client === "claude_code") {
    return CLAUDE_NATIVE_ENTRY_POINTS;
  }

  return [];
}
