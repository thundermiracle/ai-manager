import type { FormEvent } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import type { TransportMode } from "./useMcpAddForm";
import type { McpEditFormState } from "./useMcpEditForm";

interface McpEditFormProps {
  disabled: boolean;
  state: McpEditFormState;
  onTransportModeChange: (value: TransportMode) => void;
  onCommandChange: (value: string) => void;
  onArgsInputChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  className?: string;
}

export function McpEditForm({
  disabled,
  state,
  onTransportModeChange,
  onCommandChange,
  onArgsInputChange,
  onUrlChange,
  onEnabledChange,
  onSubmit,
  className,
}: McpEditFormProps) {
  return (
    <form
      className={cn("grid min-w-0 content-start gap-2", className)}
      onSubmit={(event) => void onSubmit(event)}
    >
      {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

      {state.transportMode === "stdio" && state.command.trim().length === 0 ? (
        <Alert variant="warning">
          Existing stdio command could not be auto-detected. Enter command and args to continue.
        </Alert>
      ) : null}
      {state.transportMode === "sse" && state.url.trim().length === 0 ? (
        <Alert variant="warning">
          Existing SSE URL could not be auto-detected. Enter the URL to continue.
        </Alert>
      ) : null}

      <Label htmlFor="mcp-edit-target-id">Target ID</Label>
      <Input id="mcp-edit-target-id" value={state.targetId} disabled />

      <Label htmlFor="mcp-edit-transport-mode">Transport</Label>
      <select
        id="mcp-edit-transport-mode"
        className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        value={state.transportMode}
        onChange={(event) => onTransportModeChange(event.currentTarget.value as TransportMode)}
        disabled={disabled}
      >
        <option value="stdio">stdio (command + args)</option>
        <option value="sse">sse (url)</option>
      </select>

      {state.transportMode === "stdio" ? (
        <>
          <Label htmlFor="mcp-edit-command">Command</Label>
          <Input
            id="mcp-edit-command"
            value={state.command}
            onChange={(event) => onCommandChange(event.currentTarget.value)}
            placeholder="npx"
            disabled={disabled}
          />

          <Label htmlFor="mcp-edit-args">Args (comma-separated)</Label>
          <Input
            id="mcp-edit-args"
            value={state.argsInput}
            onChange={(event) => onArgsInputChange(event.currentTarget.value)}
            placeholder="-y, @scope/package"
            disabled={disabled}
          />
        </>
      ) : (
        <>
          <Label htmlFor="mcp-edit-url">SSE URL</Label>
          <Input
            id="mcp-edit-url"
            value={state.url}
            onChange={(event) => onUrlChange(event.currentTarget.value)}
            placeholder="https://example.com/sse"
            disabled={disabled}
          />
        </>
      )}

      <label
        className="mt-1 flex items-center gap-2 text-sm text-slate-700"
        htmlFor="mcp-edit-enabled"
      >
        <input
          id="mcp-edit-enabled"
          className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          type="checkbox"
          checked={state.enabled}
          onChange={(event) => onEnabledChange(event.currentTarget.checked)}
          disabled={disabled}
        />
        Enable this MCP entry
      </label>

      <Button type="submit" disabled={disabled}>
        Update MCP
      </Button>
    </form>
  );
}
