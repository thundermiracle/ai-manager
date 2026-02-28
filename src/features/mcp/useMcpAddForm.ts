import { type FormEvent, useCallback, useState } from "react";

import type { AddMcpInput, McpTransportInput } from "./useMcpManager";

export type TransportMode = "stdio" | "sse";

export interface McpAddFormState {
  targetId: string;
  transportMode: TransportMode;
  command: string;
  argsInput: string;
  url: string;
  enabled: boolean;
  localError: string | null;
}

interface UseMcpAddFormParams {
  onSubmit: (input: AddMcpInput) => Promise<boolean>;
}

interface UseMcpAddFormResult {
  state: McpAddFormState;
  setTargetId: (value: string) => void;
  setTransportMode: (value: TransportMode) => void;
  setCommand: (value: string) => void;
  setArgsInput: (value: string) => void;
  setUrl: (value: string) => void;
  setEnabled: (value: boolean) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const DEFAULT_STATE: McpAddFormState = {
  targetId: "example.server",
  transportMode: "stdio",
  command: "npx",
  argsInput: "-y, @modelcontextprotocol/server-filesystem",
  url: "https://example.com/sse",
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

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { transport: null, error: "SSE URL must start with http:// or https://." };
  }

  return {
    transport: {
      kind: "sse",
      url: url.trim(),
    },
    error: null,
  };
}

export function useMcpAddForm({ onSubmit }: UseMcpAddFormParams): UseMcpAddFormResult {
  const [state, setState] = useState<McpAddFormState>(DEFAULT_STATE);

  const setTargetId = useCallback((value: string) => {
    setState((current) => ({ ...current, targetId: value }));
  }, []);

  const setTransportMode = useCallback((value: TransportMode) => {
    setState((current) => ({ ...current, transportMode: value }));
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
        transport,
        enabled: state.enabled,
      });

      if (accepted) {
        setState((current) => ({
          ...current,
          targetId: "",
          url: current.transportMode === "sse" ? DEFAULT_STATE.url : current.url,
        }));
      }
    },
    [onSubmit, state],
  );

  return {
    state,
    setTargetId,
    setTransportMode,
    setCommand,
    setArgsInput,
    setUrl,
    setEnabled,
    submit,
  };
}
