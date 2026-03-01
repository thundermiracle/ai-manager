import { type FormEvent, useCallback, useState } from "react";

import type { ResourceRecord } from "../../backend/contracts";
import type { TransportMode } from "./useMcpAddForm";
import type { McpTransportInput, UpdateMcpInput } from "./useMcpManager";

export interface McpEditFormState {
  targetId: string;
  sourcePath: string | null;
  transportMode: TransportMode;
  command: string;
  argsInput: string;
  url: string;
  enabled: boolean;
  localError: string | null;
}

interface UseMcpEditFormParams {
  onSubmit: (input: UpdateMcpInput) => Promise<boolean>;
  onAccepted?: () => void;
}

interface UseMcpEditFormResult {
  state: McpEditFormState;
  loadResource: (resource: ResourceRecord) => void;
  reset: () => void;
  setTransportMode: (value: TransportMode) => void;
  setCommand: (value: string) => void;
  setArgsInput: (value: string) => void;
  setUrl: (value: string) => void;
  setEnabled: (value: boolean) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const DEFAULT_STATE: McpEditFormState = {
  targetId: "",
  sourcePath: null,
  transportMode: "stdio",
  command: "",
  argsInput: "",
  url: "",
  enabled: true,
  localError: null,
};

function parseArgs(rawArgs: string): string[] {
  return rawArgs
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function createTransportPayload(
  mode: TransportMode,
  command: string,
  argsInput: string,
  url: string,
): { transport: McpTransportInput | null; error: string | null } {
  if (mode === "stdio") {
    if (command.trim().length === 0) {
      return { transport: null, error: "Command is required for stdio transport." };
    }

    return {
      transport: {
        kind: "stdio",
        command: command.trim(),
        args: parseArgs(argsInput),
      },
      error: null,
    };
  }

  const normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    return { transport: null, error: "SSE URL must start with http:// or https://." };
  }

  return {
    transport: {
      kind: "sse",
      url: normalizedUrl,
    },
    error: null,
  };
}

export function useMcpEditForm({
  onSubmit,
  onAccepted,
}: UseMcpEditFormParams): UseMcpEditFormResult {
  const [state, setState] = useState<McpEditFormState>(DEFAULT_STATE);

  const loadResource = useCallback((resource: ResourceRecord) => {
    const transportMode: TransportMode = resource.transport_kind === "sse" ? "sse" : "stdio";
    setState({
      targetId: resource.display_name,
      sourcePath: resource.source_path,
      transportMode,
      command: resource.transport_command ?? "",
      argsInput: (resource.transport_args ?? []).join(", "),
      url: resource.transport_url ?? "",
      enabled: resource.enabled,
      localError: null,
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const setTransportMode = useCallback((value: TransportMode) => {
    setState((current) => ({ ...current, transportMode: value, localError: null }));
  }, []);

  const setCommand = useCallback((value: string) => {
    setState((current) => ({ ...current, command: value }));
  }, []);

  const setArgsInput = useCallback((value: string) => {
    setState((current) => ({ ...current, argsInput: value }));
  }, []);

  const setUrl = useCallback((value: string) => {
    setState((current) => ({ ...current, url: value }));
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setState((current) => ({ ...current, enabled: value }));
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setState((current) => ({ ...current, localError: null }));

      const normalizedTargetId = state.targetId.trim();
      if (normalizedTargetId.length === 0) {
        setState((current) => ({ ...current, localError: "Target ID is required." }));
        return;
      }

      const { transport, error } = createTransportPayload(
        state.transportMode,
        state.command,
        state.argsInput,
        state.url,
      );
      if (error || transport === null) {
        setState((current) => ({
          ...current,
          localError: error ?? "Transport configuration is invalid.",
        }));
        return;
      }

      const accepted = await onSubmit({
        targetId: normalizedTargetId,
        sourcePath: state.sourcePath,
        transport,
        enabled: state.enabled,
      });

      if (accepted) {
        onAccepted?.();
      }
    },
    [onAccepted, onSubmit, state],
  );

  return {
    state,
    loadResource,
    reset,
    setTransportMode,
    setCommand,
    setArgsInput,
    setUrl,
    setEnabled,
    submit,
  };
}
