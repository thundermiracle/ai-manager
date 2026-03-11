import type { ClientKind } from "../../backend/contracts";

export function toggleClientFilterSelection(
  current: ClientKind[],
  client: ClientKind,
  availableClients: readonly ClientKind[],
): ClientKind[] {
  const next = current.includes(client)
    ? current.filter((entry) => entry !== client)
    : [...current, client];

  return availableClients.filter((entry) => next.includes(entry));
}
