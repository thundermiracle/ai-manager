import { type FormEvent, useState } from "react";

import type { AddMcpInput, McpTransportInput } from "../useMcpManager";

interface McpAddFormProps {
  disabled: boolean;
  onSubmit: (input: AddMcpInput) => Promise<boolean>;
}

type TransportMode = "stdio" | "sse";

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

export function McpAddForm({ disabled, onSubmit }: McpAddFormProps) {
  const [targetId, setTargetId] = useState("example.server");
  const [transportMode, setTransportMode] = useState<TransportMode>("stdio");
  const [command, setCommand] = useState("npx");
  const [argsInput, setArgsInput] = useState("-y, @modelcontextprotocol/server-filesystem");
  const [url, setUrl] = useState("https://example.com/sse");
  const [enabled, setEnabled] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    const normalizedTargetId = targetId.trim();
    if (normalizedTargetId.length === 0) {
      setLocalError("Target ID is required.");
      return;
    }

    const { transport, error } = createTransportPayload(transportMode, command, argsInput, url);
    if (error || transport === null) {
      setLocalError(error ?? "Transport configuration is invalid.");
      return;
    }

    const accepted = await onSubmit({
      targetId: normalizedTargetId,
      transport,
      enabled,
    });

    if (accepted) {
      setTargetId("");
      if (transportMode === "sse") {
        setUrl("https://example.com/sse");
      }
    }
  }

  return (
    <form className="mcp-form" onSubmit={(event) => void handleSubmit(event)}>
      <h3>Add MCP Entry</h3>

      {localError ? <p className="mcp-feedback mcp-feedback-error">{localError}</p> : null}

      <label htmlFor="mcp-target-id">Target ID</label>
      <input
        id="mcp-target-id"
        value={targetId}
        onChange={(event) => setTargetId(event.currentTarget.value)}
        placeholder="filesystem"
        disabled={disabled}
      />

      <label htmlFor="mcp-transport-mode">Transport</label>
      <select
        id="mcp-transport-mode"
        value={transportMode}
        onChange={(event) => setTransportMode(event.currentTarget.value as TransportMode)}
        disabled={disabled}
      >
        <option value="stdio">stdio (command + args)</option>
        <option value="sse">sse (url)</option>
      </select>

      {transportMode === "stdio" ? (
        <>
          <label htmlFor="mcp-command">Command</label>
          <input
            id="mcp-command"
            value={command}
            onChange={(event) => setCommand(event.currentTarget.value)}
            placeholder="npx"
            disabled={disabled}
          />

          <label htmlFor="mcp-args">Args (comma-separated)</label>
          <input
            id="mcp-args"
            value={argsInput}
            onChange={(event) => setArgsInput(event.currentTarget.value)}
            placeholder="-y, @scope/package"
            disabled={disabled}
          />
        </>
      ) : (
        <>
          <label htmlFor="mcp-url">SSE URL</label>
          <input
            id="mcp-url"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
            placeholder="https://example.com/sse"
            disabled={disabled}
          />
        </>
      )}

      <label className="checkbox-row" htmlFor="mcp-enabled">
        <input
          id="mcp-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.currentTarget.checked)}
          disabled={disabled}
        />
        Enable this MCP entry immediately
      </label>

      <button className="ghost-button" type="submit" disabled={disabled}>
        Add MCP
      </button>
    </form>
  );
}
