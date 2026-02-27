import { type FormEvent, useState } from "react";

import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
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
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Add MCP Entry</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form className="grid content-start gap-2" onSubmit={(event) => void handleSubmit(event)}>
          {localError ? <Alert variant="destructive">{localError}</Alert> : null}

          <Label htmlFor="mcp-target-id">Target ID</Label>
          <Input
            id="mcp-target-id"
            value={targetId}
            onChange={(event) => setTargetId(event.currentTarget.value)}
            placeholder="filesystem"
            disabled={disabled}
          />

          <Label htmlFor="mcp-transport-mode">Transport</Label>
          <select
            id="mcp-transport-mode"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            value={transportMode}
            onChange={(event) => setTransportMode(event.currentTarget.value as TransportMode)}
            disabled={disabled}
          >
            <option value="stdio">stdio (command + args)</option>
            <option value="sse">sse (url)</option>
          </select>

          {transportMode === "stdio" ? (
            <>
              <Label htmlFor="mcp-command">Command</Label>
              <Input
                id="mcp-command"
                value={command}
                onChange={(event) => setCommand(event.currentTarget.value)}
                placeholder="npx"
                disabled={disabled}
              />

              <Label htmlFor="mcp-args">Args (comma-separated)</Label>
              <Input
                id="mcp-args"
                value={argsInput}
                onChange={(event) => setArgsInput(event.currentTarget.value)}
                placeholder="-y, @scope/package"
                disabled={disabled}
              />
            </>
          ) : (
            <>
              <Label htmlFor="mcp-url">SSE URL</Label>
              <Input
                id="mcp-url"
                value={url}
                onChange={(event) => setUrl(event.currentTarget.value)}
                placeholder="https://example.com/sse"
                disabled={disabled}
              />
            </>
          )}

          <label
            className="mt-1 flex items-center gap-2 text-sm text-slate-700"
            htmlFor="mcp-enabled"
          >
            <input
              id="mcp-enabled"
              className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.currentTarget.checked)}
              disabled={disabled}
            />
            Enable this MCP entry immediately
          </label>

          <Button variant="outline" type="submit" disabled={disabled}>
            Add MCP
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
