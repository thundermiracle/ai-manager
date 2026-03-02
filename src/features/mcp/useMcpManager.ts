import { useCallback, useEffect, useState } from "react";

import { listResources, mutateResource } from "../../backend/client";
import type { ClientKind, CommandEnvelope, ResourceRecord } from "../../backend/contracts";
import { redactNullableSensitiveText, redactSensitiveText } from "../../security/redaction";
import {
  commandErrorToDiagnostic,
  type ErrorDiagnostic,
  runtimeErrorToDiagnostic,
} from "../common/errorDiagnostics";

export type McpTransportInput =
  | {
      kind: "stdio";
      command: string;
      args: string[];
    }
  | {
      kind: "sse";
      url: string;
    };

export interface AddMcpInput {
  targetId: string;
  transport: McpTransportInput;
  enabled: boolean;
}

export interface UpdateMcpInput {
  targetId: string;
  transport: McpTransportInput;
  enabled: boolean;
  sourcePath: string | null;
}

export interface CopyMcpInput {
  sourceClient: ClientKind;
  sourceResourceId: string;
  destinationClient: ClientKind;
  targetId: string;
  transport: McpTransportInput;
  enabled: boolean;
}

interface MutationFeedback {
  kind: "success" | "error";
  message: string;
  diagnostic?: ErrorDiagnostic;
}

type LoadPhase = "idle" | "loading" | "ready" | "error";

interface UseMcpManagerResult {
  phase: LoadPhase;
  resources: ResourceRecord[];
  warning: string | null;
  operationError: ErrorDiagnostic | null;
  feedback: MutationFeedback | null;
  pendingRemovalId: string | null;
  pendingUpdateId: string | null;
  pendingCopyId: string | null;
  refresh: () => Promise<void>;
  addMcp: (input: AddMcpInput) => Promise<boolean>;
  updateMcp: (input: UpdateMcpInput) => Promise<boolean>;
  copyMcp: (input: CopyMcpInput) => Promise<boolean>;
  removeMcp: (targetId: string, sourcePath: string | null) => Promise<boolean>;
  clearFeedback: () => void;
}

function envelopeErrorDiagnostic(
  envelope: CommandEnvelope<unknown>,
  fallbackMessage: string,
): ErrorDiagnostic {
  if (envelope.error) {
    return commandErrorToDiagnostic(envelope.error);
  }
  return runtimeErrorToDiagnostic(fallbackMessage);
}

function sortResources(resources: ResourceRecord[]): ResourceRecord[] {
  return [...resources].sort((left, right) => {
    if (left.display_name !== right.display_name) {
      return left.display_name.localeCompare(right.display_name);
    }
    return left.id.localeCompare(right.id);
  });
}

export function useMcpManager(client: ClientKind | null): UseMcpManagerResult {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<ErrorDiagnostic | null>(null);
  const [feedback, setFeedback] = useState<MutationFeedback | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const [pendingCopyId, setPendingCopyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (client === null) {
      setPhase("idle");
      setResources([]);
      setWarning(null);
      setOperationError(null);
      return;
    }

    setPhase("loading");
    setOperationError(null);

    try {
      const envelope = await listResources({
        client,
        resource_kind: "mcp",
      });

      if (!envelope.ok || envelope.data === null) {
        setPhase("error");
        setOperationError(
          envelopeErrorDiagnostic(
            envelope,
            "List command failed without an explicit error payload.",
          ),
        );
        return;
      }

      setResources(sortResources(envelope.data.items));
      setWarning(redactNullableSensitiveText(envelope.data.warning));
      setOperationError(null);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      const message = error instanceof Error ? error.message : "Unknown list runtime error.";
      setOperationError(runtimeErrorToDiagnostic(message));
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addMcp = useCallback(
    async (input: AddMcpInput) => {
      if (client === null) {
        const diagnostic = runtimeErrorToDiagnostic("Select a client before adding an MCP entry.");
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      const transport =
        input.transport.kind === "stdio"
          ? { command: input.transport.command, args: input.transport.args }
          : { url: input.transport.url };

      const sourcePathHint = resources.find((entry) => entry.source_path !== null)?.source_path;
      const payload: Record<string, unknown> = {
        transport,
        enabled: input.enabled,
      };
      if (sourcePathHint !== null && sourcePathHint !== undefined) {
        payload.source_path = sourcePathHint;
      }

      try {
        const envelope = await mutateResource({
          client,
          resource_kind: "mcp",
          action: "add",
          target_id: input.targetId,
          payload,
        });

        if (!envelope.ok || envelope.data === null) {
          const diagnostic = envelopeErrorDiagnostic(
            envelope,
            "Mutation command failed without an explicit error payload.",
          );
          setFeedback({ kind: "error", message: diagnostic.message, diagnostic });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        await refresh();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown add runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }
    },
    [client, refresh, resources],
  );

  const removeMcp = useCallback(
    async (targetId: string, sourcePath: string | null) => {
      if (client === null) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Select a client before removing an MCP entry.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      setPendingRemovalId(targetId);
      try {
        const envelope = await mutateResource({
          client,
          resource_kind: "mcp",
          action: "remove",
          target_id: targetId,
          payload: sourcePath ? { source_path: sourcePath } : null,
        });

        if (!envelope.ok || envelope.data === null) {
          const diagnostic = envelopeErrorDiagnostic(
            envelope,
            "Mutation command failed without an explicit error payload.",
          );
          setFeedback({ kind: "error", message: diagnostic.message, diagnostic });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        await refresh();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown remove runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      } finally {
        setPendingRemovalId(null);
      }
    },
    [client, refresh],
  );

  const updateMcp = useCallback(
    async (input: UpdateMcpInput) => {
      if (client === null) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Select a client before updating an MCP entry.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      const payloadTransport =
        input.transport.kind === "stdio"
          ? { command: input.transport.command, args: input.transport.args }
          : { url: input.transport.url };

      setPendingUpdateId(input.targetId);
      try {
        const envelope = await mutateResource({
          client,
          resource_kind: "mcp",
          action: "update",
          target_id: input.targetId,
          payload: {
            source_path: input.sourcePath,
            transport: payloadTransport,
            enabled: input.enabled,
          },
        });

        if (!envelope.ok || envelope.data === null) {
          const diagnostic = envelopeErrorDiagnostic(
            envelope,
            "Mutation command failed without an explicit error payload.",
          );
          setFeedback({ kind: "error", message: diagnostic.message, diagnostic });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        await refresh();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown update runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      } finally {
        setPendingUpdateId(null);
      }
    },
    [client, refresh],
  );

  const copyMcp = useCallback(
    async (input: CopyMcpInput) => {
      if (client === null) {
        const diagnostic = runtimeErrorToDiagnostic("Select a client before copying an MCP entry.");
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      if (input.sourceClient !== client) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Selected source client is stale. Reload the MCP list and retry the copy operation.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      if (input.destinationClient === input.sourceClient) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Choose a different destination client when copying an MCP entry.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      const normalizedTargetId = input.targetId.trim();
      if (normalizedTargetId.length === 0) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Target ID is required before copying an MCP entry.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      const payloadTransport =
        input.transport.kind === "stdio"
          ? { command: input.transport.command, args: input.transport.args }
          : { url: input.transport.url };

      setPendingCopyId(input.sourceResourceId);
      try {
        const envelope = await mutateResource({
          client: input.destinationClient,
          resource_kind: "mcp",
          action: "add",
          target_id: normalizedTargetId,
          payload: {
            transport: payloadTransport,
            enabled: input.enabled,
          },
        });

        if (!envelope.ok || envelope.data === null) {
          const diagnostic = envelopeErrorDiagnostic(
            envelope,
            "Mutation command failed without an explicit error payload.",
          );
          setFeedback({ kind: "error", message: diagnostic.message, diagnostic });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown copy runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      } finally {
        setPendingCopyId(null);
      }
    },
    [client],
  );

  return {
    phase,
    resources,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    pendingUpdateId,
    pendingCopyId,
    refresh,
    addMcp,
    updateMcp,
    copyMcp,
    removeMcp,
    clearFeedback: () => setFeedback(null),
  };
}
