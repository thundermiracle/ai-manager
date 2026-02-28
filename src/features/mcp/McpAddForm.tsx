import type { FormEvent } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { McpAddFormState, TransportMode } from "./useMcpAddForm";

interface McpAddFormProps {
  disabled: boolean;
  state: McpAddFormState;
  onTargetIdChange: (value: string) => void;
  onTransportModeChange: (value: TransportMode) => void;
  onCommandChange: (value: string) => void;
  onArgsInputChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function McpAddForm({
  disabled,
  state,
  onTargetIdChange,
  onTransportModeChange,
  onCommandChange,
  onArgsInputChange,
  onUrlChange,
  onEnabledChange,
  onSubmit,
}: McpAddFormProps) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Add MCP Entry</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form className="grid content-start gap-2" onSubmit={(event) => void onSubmit(event)}>
          {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

          <Label htmlFor="mcp-target-id">Target ID</Label>
          <Input
            id="mcp-target-id"
            value={state.targetId}
            onChange={(event) => onTargetIdChange(event.currentTarget.value)}
            placeholder="filesystem"
            disabled={disabled}
          />

          <Label htmlFor="mcp-transport-mode">Transport</Label>
          <select
            id="mcp-transport-mode"
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
              <Label htmlFor="mcp-command">Command</Label>
              <Input
                id="mcp-command"
                value={state.command}
                onChange={(event) => onCommandChange(event.currentTarget.value)}
                placeholder="npx"
                disabled={disabled}
              />

              <Label htmlFor="mcp-args">Args (comma-separated)</Label>
              <Input
                id="mcp-args"
                value={state.argsInput}
                onChange={(event) => onArgsInputChange(event.currentTarget.value)}
                placeholder="-y, @scope/package"
                disabled={disabled}
              />
            </>
          ) : (
            <>
              <Label htmlFor="mcp-url">SSE URL</Label>
              <Input
                id="mcp-url"
                value={state.url}
                onChange={(event) => onUrlChange(event.currentTarget.value)}
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
              checked={state.enabled}
              onChange={(event) => onEnabledChange(event.currentTarget.checked)}
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
