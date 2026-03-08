import { useCallback, useEffect, useState } from "react";

import { listResources, mutateResource, replicateResource } from "../../backend/client";
import type {
  ClientKind,
  CommandEnvelope,
  ResourceRecord,
  ResourceViewMode,
} from "../../backend/contracts";
import { redactNullableSensitiveText, redactSensitiveText } from "../../security/redaction";
import {
  commandErrorToDiagnostic,
  type ErrorDiagnostic,
  runtimeErrorToDiagnostic,
} from "../common/errorDiagnostics";
import type { ResourceContextMode } from "../resources/resource-context";

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
  destinationClient: ClientKind;
  targetId: string;
  transport: McpTransportInput;
  enabled: boolean;
  projectRoot: string | null;
  targetSourceId: string | null;
}

export interface UpdateMcpInput {
  resourceId: string;
  client: ClientKind;
  targetId: string;
  transport: McpTransportInput;
  enabled: boolean;
  projectRoot: string | null;
  targetSourceId: string;
  sourceLabel: string;
}

export interface CopyMcpInput {
  action: "copy" | "promote";
  sourceClient: ClientKind;
  sourceResourceId: string;
  sourceTargetId: string;
  sourceSourceId: string;
  destinationClient: ClientKind;
  targetId: string;
  sourceProjectRoot: string | null;
  destinationProjectRoot: string | null;
  destinationSourceId: string | null;
  sourceLabel: string;
  overwrite: boolean;
}

export interface RemoveMcpInput {
  resourceId: string;
  client: ClientKind;
  targetId: string;
  projectRoot: string | null;
  targetSourceId: string;
  sourceLabel: string;
}

interface UseMcpManagerParams {
  contextMode: ResourceContextMode;
  projectRoot: string | null;
  viewMode: ResourceViewMode;
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
  sourceAwareResources: ResourceRecord[];
  resolvedProjectRoot: string | null;
  warning: string | null;
  operationError: ErrorDiagnostic | null;
  feedback: MutationFeedback | null;
  pendingRemovalId: string | null;
  pendingUpdateId: string | null;
  pendingReplicationId: string | null;
  refresh: () => Promise<void>;
  addMcp: (input: AddMcpInput) => Promise<boolean>;
  updateMcp: (input: UpdateMcpInput) => Promise<boolean>;
  copyMcp: (input: CopyMcpInput) => Promise<boolean>;
  removeMcp: (input: RemoveMcpInput) => Promise<boolean>;
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

export function useMcpManager({
  contextMode,
  projectRoot,
  viewMode,
}: UseMcpManagerParams): UseMcpManagerResult {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [sourceAwareResources, setSourceAwareResources] = useState<ResourceRecord[]>([]);
  const [resolvedProjectRoot, setResolvedProjectRoot] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<ErrorDiagnostic | null>(null);
  const [feedback, setFeedback] = useState<MutationFeedback | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const [pendingReplicationId, setPendingReplicationId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPhase("loading");
    setOperationError(null);

    try {
      const envelope = await listResources({
        client: null,
        resource_kind: "mcp",
        project_root: contextMode === "project" ? projectRoot : null,
        view_mode: viewMode,
      });

      if (!envelope.ok || envelope.data === null) {
        setPhase("error");
        setSourceAwareResources([]);
        setResolvedProjectRoot(null);
        setOperationError(
          envelopeErrorDiagnostic(
            envelope,
            "List command failed without an explicit error payload.",
          ),
        );
        return;
      }

      let allSourceItems = envelope.data.items;
      if (viewMode !== "all_sources") {
        const allSourcesEnvelope = await listResources({
          client: null,
          resource_kind: "mcp",
          project_root: contextMode === "project" ? projectRoot : null,
          view_mode: "all_sources",
        });
        if (allSourcesEnvelope.ok && allSourcesEnvelope.data) {
          allSourceItems = allSourcesEnvelope.data.items;
        }
      }

      setResources(sortResources(envelope.data.items));
      setSourceAwareResources(sortResources(allSourceItems));
      setResolvedProjectRoot(envelope.data.project_root);
      setWarning(redactNullableSensitiveText(envelope.data.warning));
      setOperationError(null);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setSourceAwareResources([]);
      setResolvedProjectRoot(null);
      const message = error instanceof Error ? error.message : "Unknown list runtime error.";
      setOperationError(runtimeErrorToDiagnostic(message));
    }
  }, [contextMode, projectRoot, viewMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addMcp = useCallback(
    async (input: AddMcpInput) => {
      const transport =
        input.transport.kind === "stdio"
          ? { command: input.transport.command, args: input.transport.args }
          : { url: input.transport.url };
      const payload: Record<string, unknown> = {
        transport,
        enabled: input.enabled,
      };

      try {
        const envelope = await mutateResource({
          client: input.destinationClient,
          resource_kind: "mcp",
          action: "add",
          target_id: input.targetId,
          project_root: input.projectRoot,
          target_source_id: input.targetSourceId,
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
    [refresh],
  );

  const removeMcp = useCallback(
    async (input: RemoveMcpInput) => {
      setPendingRemovalId(input.resourceId);
      try {
        const envelope = await mutateResource({
          client: input.client,
          resource_kind: "mcp",
          action: "remove",
          target_id: input.targetId,
          project_root: input.projectRoot,
          target_source_id: input.targetSourceId,
          payload: null,
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
          message: `${input.sourceLabel}: ${diagnostic.message}`,
          diagnostic,
        });
        return false;
      } finally {
        setPendingRemovalId(null);
      }
    },
    [refresh],
  );

  const updateMcp = useCallback(
    async (input: UpdateMcpInput) => {
      const payloadTransport =
        input.transport.kind === "stdio"
          ? { command: input.transport.command, args: input.transport.args }
          : { url: input.transport.url };

      setPendingUpdateId(input.resourceId);
      try {
        const envelope = await mutateResource({
          client: input.client,
          resource_kind: "mcp",
          action: "update",
          target_id: input.targetId,
          project_root: input.projectRoot,
          target_source_id: input.targetSourceId,
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
        await refresh();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown update runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: `${input.sourceLabel}: ${diagnostic.message}`,
          diagnostic,
        });
        return false;
      } finally {
        setPendingUpdateId(null);
      }
    },
    [refresh],
  );

  const copyMcp = useCallback(
    async (input: CopyMcpInput) => {
      if (input.action === "copy" && input.destinationClient === input.sourceClient) {
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

      setPendingReplicationId(input.sourceResourceId);
      try {
        const envelope = await replicateResource({
          resource_kind: "mcp",
          source_client: input.sourceClient,
          source_target_id: input.sourceTargetId,
          source_source_id: input.sourceSourceId,
          source_project_root: input.sourceProjectRoot,
          destination_client: input.destinationClient,
          destination_target_id: normalizedTargetId,
          destination_source_id: input.destinationSourceId,
          destination_project_root: input.destinationProjectRoot,
          overwrite: input.overwrite,
        });

        if (!envelope.ok || envelope.data === null) {
          const diagnostic = envelopeErrorDiagnostic(
            envelope,
            "Replication command failed without an explicit error payload.",
          );
          setFeedback({ kind: "error", message: diagnostic.message, diagnostic });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        await refresh();
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown replication runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: `${input.sourceLabel}: ${diagnostic.message}`,
          diagnostic,
        });
        return false;
      } finally {
        setPendingReplicationId(null);
      }
    },
    [refresh],
  );

  return {
    phase,
    resources,
    sourceAwareResources,
    resolvedProjectRoot,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    pendingUpdateId,
    pendingReplicationId,
    refresh,
    addMcp,
    updateMcp,
    copyMcp,
    removeMcp,
    clearFeedback: () => setFeedback(null),
  };
}
