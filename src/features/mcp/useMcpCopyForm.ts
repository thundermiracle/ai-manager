import { type FormEvent, useCallback, useState } from "react";

import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import {
  buildMcpCopyDestinationClients,
  canPromoteMcpResource,
  type McpReplicationAction,
} from "./mcp-targets";
import type { CopyMcpInput } from "./useMcpManager";

export interface McpCopyFormState {
  mode: McpReplicationAction;
  availableModes: McpReplicationAction[];
  sourceResourceId: string;
  sourceClient: ClientKind;
  sourceDisplayName: string;
  sourceTargetId: string;
  sourceSourceId: string;
  sourceLabel: string;
  sourceProjectRoot: string | null;
  destinationClient: ClientKind;
  targetId: string;
  overwrite: boolean;
  transportPreview: string;
  localError: string | null;
}

interface UseMcpCopyFormParams {
  onSubmit: (input: CopyMcpInput) => Promise<boolean>;
  resolveDestination: (
    client: ClientKind,
    action: McpReplicationAction,
  ) => {
    projectRoot: string | null;
    targetSourceId: string | null;
  };
  onAccepted?: () => void;
}

interface LoadCopyResourceOptions {
  preferredAction: McpReplicationAction;
  projectRoot: string | null;
}

interface UseMcpCopyFormResult {
  state: McpCopyFormState;
  loadResource: (resource: ResourceRecord, options: LoadCopyResourceOptions) => void;
  reset: () => void;
  setMode: (value: McpReplicationAction) => void;
  setDestinationClient: (value: ClientKind) => void;
  setTargetId: (value: string) => void;
  setOverwrite: (value: boolean) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

function pickDefaultDestination(sourceClient: ClientKind): ClientKind {
  return buildMcpCopyDestinationClients(sourceClient)[0] ?? sourceClient;
}

function resolveTransportPreview(resource: ResourceRecord): {
  preview: string;
  error: string | null;
} {
  const transportKind = resource.transport_kind ?? "stdio";

  if (transportKind === "sse") {
    const url = resource.transport_url?.trim() ?? "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return {
        preview: "sse transport (invalid or missing URL)",
        error: "SSE URL is missing or invalid in the source entry.",
      };
    }

    return {
      preview: `sse: ${url}`,
      error: null,
    };
  }

  const command = resource.transport_command?.trim() ?? "";
  if (command.length === 0) {
    return {
      preview: "stdio transport (missing command)",
      error: "stdio command is missing in the source entry.",
    };
  }

  const args = resource.transport_args ?? [];
  return {
    preview: `stdio: ${command}${args.length > 0 ? ` ${args.join(" ")}` : ""}`,
    error: null,
  };
}

function resolveAvailableModes(resource: ResourceRecord): McpReplicationAction[] {
  return canPromoteMcpResource(resource) ? ["copy", "promote"] : ["copy"];
}

function selectInitialMode(
  availableModes: McpReplicationAction[],
  preferredAction: McpReplicationAction,
): McpReplicationAction {
  return availableModes.includes(preferredAction) ? preferredAction : (availableModes[0] ?? "copy");
}

const DEFAULT_STATE: McpCopyFormState = {
  mode: "copy",
  availableModes: ["copy"],
  sourceResourceId: "",
  sourceClient: "codex",
  sourceDisplayName: "",
  sourceTargetId: "",
  sourceSourceId: "",
  sourceLabel: "",
  sourceProjectRoot: null,
  destinationClient: "claude_code",
  targetId: "",
  overwrite: false,
  transportPreview: "",
  localError: null,
};

export function useMcpCopyForm({
  onSubmit,
  resolveDestination,
  onAccepted,
}: UseMcpCopyFormParams): UseMcpCopyFormResult {
  const [state, setState] = useState<McpCopyFormState>(DEFAULT_STATE);

  const loadResource = useCallback((resource: ResourceRecord, options: LoadCopyResourceOptions) => {
    const availableModes = resolveAvailableModes(resource);
    const mode = selectInitialMode(availableModes, options.preferredAction);
    const transport = resolveTransportPreview(resource);

    setState({
      mode,
      availableModes,
      sourceResourceId: resource.id,
      sourceClient: resource.client,
      sourceDisplayName: resource.display_name,
      sourceTargetId: resource.logical_id,
      sourceSourceId: resource.source_id,
      sourceLabel: resource.source_label,
      sourceProjectRoot: resource.source_scope === "user" ? null : options.projectRoot,
      destinationClient:
        mode === "promote" ? resource.client : pickDefaultDestination(resource.client),
      targetId: resource.display_name,
      overwrite: false,
      transportPreview: transport.preview,
      localError: transport.error,
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const setMode = useCallback((value: McpReplicationAction) => {
    setState((current) => ({
      ...current,
      mode: current.availableModes.includes(value) ? value : current.mode,
      destinationClient:
        value === "promote" ? current.sourceClient : pickDefaultDestination(current.sourceClient),
      overwrite: false,
      localError: null,
    }));
  }, []);

  const setDestinationClient = useCallback((value: ClientKind) => {
    setState((current) => ({
      ...current,
      destinationClient: value,
      overwrite: false,
      localError: null,
    }));
  }, []);

  const setTargetId = useCallback((value: string) => {
    setState((current) => ({ ...current, targetId: value, overwrite: false }));
  }, []);

  const setOverwrite = useCallback((value: boolean) => {
    setState((current) => ({ ...current, overwrite: value, localError: null }));
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setState((current) => ({ ...current, localError: null }));

      if (state.sourceResourceId.length === 0) {
        setState((current) => ({ ...current, localError: "Select a source MCP entry first." }));
        return;
      }

      const normalizedTargetId = state.targetId.trim();
      if (normalizedTargetId.length === 0) {
        setState((current) => ({ ...current, localError: "Target ID is required." }));
        return;
      }

      if (state.mode === "copy" && state.destinationClient === state.sourceClient) {
        setState((current) => ({
          ...current,
          localError: "Choose a destination client different from the source client.",
        }));
        return;
      }

      if (state.localError !== null) {
        return;
      }

      const destinationClient =
        state.mode === "promote" ? state.sourceClient : state.destinationClient;
      const destination = resolveDestination(destinationClient, state.mode);
      const accepted = await onSubmit({
        action: state.mode,
        sourceClient: state.sourceClient,
        sourceResourceId: state.sourceResourceId,
        sourceTargetId: state.sourceTargetId,
        sourceSourceId: state.sourceSourceId,
        sourceProjectRoot: state.sourceProjectRoot,
        destinationClient,
        targetId: normalizedTargetId,
        destinationProjectRoot: destination.projectRoot,
        destinationSourceId: destination.targetSourceId,
        sourceLabel: state.sourceLabel,
        overwrite: state.overwrite,
      });

      if (accepted) {
        setState(DEFAULT_STATE);
        onAccepted?.();
      }
    },
    [onAccepted, onSubmit, resolveDestination, state],
  );

  return {
    state,
    loadResource,
    reset,
    setMode,
    setDestinationClient,
    setTargetId,
    setOverwrite,
    submit,
  };
}
