import { useCallback, useEffect, useMemo, useState } from "react";

import { listResources, mutateResource } from "../../backend/client";
import type { ClientKind, CommandEnvelope, ResourceRecord } from "../../backend/contracts";
import {
  redactNullableSensitiveText,
  redactSensitiveText,
  toRedactedRuntimeErrorMessage,
} from "../../security/redaction";

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

interface MutationFeedback {
  kind: "success" | "error";
  message: string;
}

type LoadPhase = "idle" | "loading" | "ready" | "error";

interface UseMcpManagerResult {
  phase: LoadPhase;
  resources: ResourceRecord[];
  warning: string | null;
  operationError: string | null;
  feedback: MutationFeedback | null;
  pendingRemovalId: string | null;
  sourcePathHint: string | null;
  refresh: () => Promise<void>;
  addMcp: (input: AddMcpInput) => Promise<boolean>;
  removeMcp: (targetId: string, sourcePath: string | null) => Promise<boolean>;
  clearFeedback: () => void;
}

function envelopeErrorMessage(envelope: CommandEnvelope<unknown>): string {
  if (envelope.error?.message) {
    return redactSensitiveText(envelope.error.message);
  }
  return redactSensitiveText("Command failed without an explicit error payload.");
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
  const [operationError, setOperationError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<MutationFeedback | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);

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
        setOperationError(envelopeErrorMessage(envelope));
        return;
      }

      setResources(sortResources(envelope.data.items));
      setWarning(redactNullableSensitiveText(envelope.data.warning));
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setOperationError(toRedactedRuntimeErrorMessage(error, "Unknown list runtime error."));
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addMcp = useCallback(
    async (input: AddMcpInput) => {
      if (client === null) {
        setFeedback({
          kind: "error",
          message: redactSensitiveText("Select a client before adding an MCP entry."),
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
          setFeedback({ kind: "error", message: envelopeErrorMessage(envelope) });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        await refresh();
        return true;
      } catch (error) {
        setFeedback({
          kind: "error",
          message: toRedactedRuntimeErrorMessage(error, "Unknown add runtime error."),
        });
        return false;
      }
    },
    [client, refresh, resources],
  );

  const removeMcp = useCallback(
    async (targetId: string, sourcePath: string | null) => {
      if (client === null) {
        setFeedback({
          kind: "error",
          message: redactSensitiveText("Select a client before removing an MCP entry."),
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
          setFeedback({ kind: "error", message: envelopeErrorMessage(envelope) });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        await refresh();
        return true;
      } catch (error) {
        setFeedback({
          kind: "error",
          message: toRedactedRuntimeErrorMessage(error, "Unknown remove runtime error."),
        });
        return false;
      } finally {
        setPendingRemovalId(null);
      }
    },
    [client, refresh],
  );

  const sourcePathHint = useMemo(
    () => resources.find((entry) => entry.source_path !== null)?.source_path ?? null,
    [resources],
  );

  return {
    phase,
    resources,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    sourcePathHint,
    refresh,
    addMcp,
    removeMcp,
    clearFeedback: () => setFeedback(null),
  };
}
