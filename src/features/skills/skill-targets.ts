import type { ClientKind } from "../../backend/contracts";
import { formatClientLabel } from "../clients/client-labels";

export const SKILL_CLIENTS: ClientKind[] = ["claude_code", "cursor", "codex"];

export function buildSkillCopyDestinationClients(sourceClient: ClientKind): ClientKind[] {
  return SKILL_CLIENTS.filter((client) => client !== sourceClient);
}

export function buildSkillDestinationDescription(client: ClientKind): string {
  return `${formatClientLabel(client)} stores generic skills in its personal AI Manager skill library.`;
}

export function describeSkillAction(
  action: "add" | "update" | "remove" | "copy" | "import",
  client?: ClientKind,
): string {
  const clientLabel = client ? formatClientLabel(client) : null;

  switch (action) {
    case "add":
      return clientLabel ? `Add to ${clientLabel} personal library` : "Add personal skill";
    case "update":
      return clientLabel ? `Update ${clientLabel} personal skill` : "Update personal skill";
    case "remove":
      return clientLabel ? `Remove from ${clientLabel} personal library` : "Remove from personal";
    case "copy":
      return "Copy to another client";
    case "import":
      return clientLabel
        ? `Import to ${clientLabel} personal library`
        : "Import to personal skills";
  }
}
