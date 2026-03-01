import { type FormEvent, useCallback, useEffect, useState } from "react";

import { searchRegistryPresets } from "./mcp-registry";
import { MCP_FALLBACK_PRESETS, type McpOfficialPreset } from "./official-presets";
import type { AddMcpInput, McpTransportInput } from "./useMcpManager";

export type TransportMode = "stdio" | "sse";
export type McpAddMode = "registry" | "preset" | "manual";

export type McpPresetSource = "registry" | "preset";

export interface McpAddFormState {
  mode: McpAddMode;
  targetId: string;
  transportMode: TransportMode;
  command: string;
  argsInput: string;
  url: string;
  enabled: boolean;
  selectedRegistryPresetId: string;
  selectedPresetId: string;
  registryQuery: string;
  registryLoading: boolean;
  registryError: string | null;
  registryResults: McpOfficialPreset[];
  presets: McpOfficialPreset[];
  localError: string | null;
}

interface UseMcpAddFormParams {
  onSubmit: (input: AddMcpInput) => Promise<boolean>;
  onAccepted?: () => void;
}

interface UseMcpAddFormResult {
  state: McpAddFormState;
  setMode: (value: McpAddMode) => void;
  setTargetId: (value: string) => void;
  setTransportMode: (value: TransportMode) => void;
  setCommand: (value: string) => void;
  setArgsInput: (value: string) => void;
  setUrl: (value: string) => void;
  setEnabled: (value: boolean) => void;
  setRegistryQuery: (value: string) => void;
  reloadRegistry: () => Promise<void>;
  applyPreset: (preset: McpOfficialPreset, source: McpPresetSource) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const DEFAULT_STATE: McpAddFormState = {
  mode: "registry",
  targetId: "example.server",
  transportMode: "stdio",
  command: "npx",
  argsInput: "-y, @modelcontextprotocol/server-filesystem",
  url: "https://example.com/sse",
  enabled: true,
  selectedRegistryPresetId: "",
  selectedPresetId: "",
  registryQuery: "figma",
  registryLoading: false,
  registryError: null,
  registryResults: [],
  presets: MCP_FALLBACK_PRESETS,
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

export function useMcpAddForm({ onSubmit, onAccepted }: UseMcpAddFormParams): UseMcpAddFormResult {
  const [state, setState] = useState<McpAddFormState>(DEFAULT_STATE);

  const setMode = useCallback((value: McpAddMode) => {
    setState((current) => ({ ...current, mode: value, localError: null }));
  }, []);

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

  const setRegistryQuery = useCallback((value: string) => {
    setState((current) => ({ ...current, registryQuery: value }));
  }, []);

  const reloadRegistry = useCallback(async () => {
    const query = state.registryQuery.trim();
    if (query.length === 0) {
      setState((current) => ({
        ...current,
        registryError: "Enter a registry search query.",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      registryLoading: true,
      registryError: null,
    }));

    try {
      const discovered = await searchRegistryPresets(query, 30);
      setState((current) => ({
        ...current,
        registryLoading: false,
        registryResults: discovered,
        registryError:
          discovered.length > 0 ? null : "No official MCP registry results found for this query.",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown registry error.";
      setState((current) => ({
        ...current,
        registryLoading: false,
        registryResults: [],
        registryError: `Registry request failed (${message}).`,
      }));
    }
  }, [state.registryQuery]);

  useEffect(() => {
    void (async () => {
      try {
        const discovered = await searchRegistryPresets(DEFAULT_STATE.registryQuery, 30);
        setState((current) => ({
          ...current,
          registryResults: discovered,
          registryError:
            discovered.length > 0 ? null : "No official MCP registry results found for this query.",
        }));
      } catch {
        setState((current) => ({
          ...current,
          registryResults: [],
          registryError: "Registry request failed.",
        }));
      }
    })();
  }, []);

  const applyPreset = useCallback((preset: McpOfficialPreset, source: McpPresetSource) => {
    const sourceState =
      source === "registry"
        ? { selectedRegistryPresetId: preset.id }
        : { selectedPresetId: preset.id };

    setState((current) => {
      if (preset.transport.mode === "stdio") {
        return {
          ...current,
          ...sourceState,
          targetId: preset.targetId,
          transportMode: "stdio",
          command: preset.transport.command,
          argsInput: preset.transport.args.join(", "),
          localError: null,
        };
      }

      return {
        ...current,
        ...sourceState,
        targetId: preset.targetId,
        transportMode: "sse",
        url: preset.transport.url,
        localError: null,
      };
    });
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

      if (state.mode === "registry" && state.selectedRegistryPresetId.trim().length === 0) {
        setState((current) => ({
          ...current,
          localError: "Select an official registry entry and click 'Use Entry' before adding.",
        }));
        return;
      }

      if (state.mode === "preset" && state.selectedPresetId.trim().length === 0) {
        setState((current) => ({
          ...current,
          localError: "Select a preset and click 'Use Preset' before adding.",
        }));
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
          targetId: resolveTargetIdForMode(current),
          url: current.transportMode === "sse" ? DEFAULT_STATE.url : current.url,
        }));
        onAccepted?.();
      }
    },
    [onAccepted, onSubmit, state],
  );

  return {
    state,
    setMode,
    setTargetId,
    setTransportMode,
    setCommand,
    setArgsInput,
    setUrl,
    setEnabled,
    setRegistryQuery,
    reloadRegistry,
    applyPreset,
    submit,
  };
}

function resolveTargetIdForMode(state: McpAddFormState): string {
  if (state.mode === "registry") {
    const matchedRegistry = state.registryResults.find(
      (item) => item.id === state.selectedRegistryPresetId,
    );
    return matchedRegistry?.targetId ?? "";
  }
  if (state.mode === "preset") {
    return state.presets.find((item) => item.id === state.selectedPresetId)?.targetId ?? "";
  }
  return "";
}
