import type { ClientKind } from "../../backend/contracts";

const CLIENT_LABELS: Record<ClientKind, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export function formatClientLabel(client: ClientKind): string {
  return CLIENT_LABELS[client];
}
