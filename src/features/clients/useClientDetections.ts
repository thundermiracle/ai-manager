import { useCallback, useEffect, useMemo, useState } from "react";

import { detectClients } from "../../backend/client";
import type { ClientDetection, ClientKind, CommandEnvelope } from "../../backend/contracts";
import {
  commandErrorToDiagnostic,
  type ErrorDiagnostic,
  runtimeErrorToDiagnostic,
} from "../common/errorDiagnostics";

const CLIENT_ORDER: ClientKind[] = ["claude_code", "codex", "cursor"];

export type DetectionLoadPhase = "loading" | "ready" | "error";

interface UseClientDetectionsResult {
  phase: DetectionLoadPhase;
  detections: ClientDetection[];
  selectedClient: ClientKind | null;
  errorMessage: string | null;
  errorDiagnostic: ErrorDiagnostic | null;
  lastOperationId: string | null;
  refresh: () => Promise<void>;
  setSelectedClient: (client: ClientKind) => void;
}

function toErrorDiagnostic(envelope: CommandEnvelope<unknown>): ErrorDiagnostic {
  if (envelope.error) {
    return commandErrorToDiagnostic(envelope.error);
  }
  return runtimeErrorToDiagnostic("Detection command failed without an explicit error message.");
}

function sortDetections(entries: ClientDetection[]): ClientDetection[] {
  const orderIndex = new Map(CLIENT_ORDER.map((client, index) => [client, index]));
  return [...entries].sort((left, right) => {
    const leftOrder = orderIndex.get(left.client) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderIndex.get(right.client) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.client.localeCompare(right.client);
  });
}

export function useClientDetections(): UseClientDetectionsResult {
  const [phase, setPhase] = useState<DetectionLoadPhase>("loading");
  const [detections, setDetections] = useState<ClientDetection[]>([]);
  const [selectedClient, setSelectedClientState] = useState<ClientKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDiagnostic, setErrorDiagnostic] = useState<ErrorDiagnostic | null>(null);
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPhase("loading");
    setErrorMessage(null);
    setErrorDiagnostic(null);

    try {
      const envelope = await detectClients({ include_versions: true });
      setLastOperationId(envelope.meta.operation_id);

      if (!envelope.ok || envelope.data === null) {
        setPhase("error");
        const diagnostic = toErrorDiagnostic(envelope);
        setErrorMessage(diagnostic.message);
        setErrorDiagnostic(diagnostic);
        return;
      }

      const ordered = sortDetections(envelope.data.clients);
      setDetections(ordered);
      setSelectedClientState((current) => {
        if (current && ordered.some((entry) => entry.client === current)) {
          return current;
        }
        return ordered[0]?.client ?? null;
      });
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      const message =
        error instanceof Error ? error.message : "Unknown runtime error while detecting clients.";
      const diagnostic = runtimeErrorToDiagnostic(message);
      setErrorMessage(diagnostic.message);
      setErrorDiagnostic(diagnostic);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      phase,
      detections,
      selectedClient,
      errorMessage,
      errorDiagnostic,
      lastOperationId,
      refresh,
      setSelectedClient: setSelectedClientState,
    }),
    [phase, detections, selectedClient, errorMessage, errorDiagnostic, lastOperationId, refresh],
  );
}
