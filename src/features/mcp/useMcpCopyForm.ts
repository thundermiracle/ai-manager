import { type FormEvent, useCallback, useState } from "react";

import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import type { CopyMcpInput, McpTransportInput } from "./useMcpManager";

export interface McpCopyFormState {
  sourceResourceId: string;
  sourceClient: ClientKind;
  sourceDisplayName: string;
  destinationClient: ClientKind;
  targetId: string;
  enabled: boolean;
  transport: McpTransportInput | null;
  transportPreview: string;
  localError: string | null;
}

interface UseMcpCopyFormParams {
  onSubmit: (input: CopyMcpInput) => Promise<boolean>;
  resolveDestination: (client: ClientKind) => {
    projectRoot: string | null;
    targetSourceId: string | null;
  };
  onAccepted?: () => void;
}

interface UseMcpCopyFormResult {
  state: McpCopyFormState;
  loadResource: (resource: ResourceRecord) => void;
  reset: () => void;
  setDestinationClient: (value: ClientKind) => void;
  setTargetId: (value: string) => void;
  setEnabled: (value: boolean) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const CLIENTS: ClientKind[] = ["codex", "claude_code", "cursor"];

function pickDefaultDestination(sourceClient: ClientKind): ClientKind {
  return CLIENTS.find((candidate) => candidate !== sourceClient) ?? sourceClient;
}

function resolveTransport(resource: ResourceRecord): {
  transport: McpTransportInput | null;
  preview: string;
  error: string | null;
} {
  const transportKind = resource.transport_kind ?? "stdio";

  if (transportKind === "sse") {
    const url = resource.transport_url?.trim() ?? "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return {
        transport: null,
        preview: "sse transport (invalid or missing URL)",
        error: "SSE URL is missing or invalid in the source entry.",
      };
    }

    return {
      transport: { kind: "sse", url },
      preview: `sse: ${url}`,
      error: null,
    };
  }

  const command = resource.transport_command?.trim() ?? "";
  if (command.length === 0) {
    return {
      transport: null,
      preview: "stdio transport (missing command)",
      error: "stdio command is missing in the source entry.",
    };
  }

  const args = resource.transport_args ?? [];
  return {
    transport: { kind: "stdio", command, args },
    preview: `stdio: ${command}${args.length > 0 ? ` ${args.join(" ")}` : ""}`,
    error: null,
  };
}

const DEFAULT_STATE: McpCopyFormState = {
  sourceResourceId: "",
  sourceClient: "codex",
  sourceDisplayName: "",
  destinationClient: "claude_code",
  targetId: "",
  enabled: true,
  transport: null,
  transportPreview: "",
  localError: null,
};

export function useMcpCopyForm({
  onSubmit,
  resolveDestination,
  onAccepted,
}: UseMcpCopyFormParams): UseMcpCopyFormResult {
  const [state, setState] = useState<McpCopyFormState>(DEFAULT_STATE);

  const loadResource = useCallback((resource: ResourceRecord) => {
    const sourceClient = resource.client;
    const transport = resolveTransport(resource);

    setState({
      sourceResourceId: resource.id,
      sourceClient,
      sourceDisplayName: resource.display_name,
      destinationClient: pickDefaultDestination(sourceClient),
      targetId: resource.display_name,
      enabled: resource.enabled,
      transport: transport.transport,
      transportPreview: transport.preview,
      localError: transport.error,
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const setDestinationClient = useCallback((value: ClientKind) => {
    setState((current) => ({
      ...current,
      destinationClient: value,
      localError: null,
    }));
  }, []);

  const setTargetId = useCallback((value: string) => {
    setState((current) => ({ ...current, targetId: value }));
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setState((current) => ({ ...current, enabled: value }));
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

      if (state.destinationClient === state.sourceClient) {
        setState((current) => ({
          ...current,
          localError: "Choose a destination client different from the source client.",
        }));
        return;
      }

      if (state.transport === null) {
        setState((current) => ({
          ...current,
          localError: "Source transport is incomplete and cannot be copied.",
        }));
        return;
      }

      const accepted = await onSubmit({
        sourceClient: state.sourceClient,
        sourceResourceId: state.sourceResourceId,
        destinationClient: state.destinationClient,
        targetId: normalizedTargetId,
        transport: state.transport,
        enabled: state.enabled,
        ...resolveDestination(state.destinationClient),
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
    setDestinationClient,
    setTargetId,
    setEnabled,
    submit,
  };
}
