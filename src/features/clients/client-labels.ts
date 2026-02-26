import type { ClientKind } from "../../backend/contracts";

const CLIENT_LABELS: Record<ClientKind, string> = {
  claude_code: "Claude Code",
  codex_cli: "Codex CLI",
  cursor: "Cursor",
  codex_app: "Codex App",
};

export function formatClientLabel(client: ClientKind): string {
  return CLIENT_LABELS[client];
}
