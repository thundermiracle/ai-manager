import type { ClientKind } from "../../backend/contracts";

const CLIENT_INSTALL_GUIDE_URLS: Record<ClientKind, string> = {
  claude_code: "https://docs.anthropic.com/en/docs/claude-code/getting-started",
  codex_cli: "https://github.com/openai/codex",
  cursor: "https://cursor.com/downloads",
  codex_app: "https://openai.com/codex/get-started/",
};

export function getClientInstallGuideUrl(client: ClientKind): string {
  return CLIENT_INSTALL_GUIDE_URLS[client];
}
