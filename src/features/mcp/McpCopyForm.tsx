import type { FormEvent } from "react";

import type { ClientKind } from "../../backend/contracts";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { formatClientLabel } from "../clients/client-labels";
import type { McpCopyFormState } from "./useMcpCopyForm";

interface McpCopyFormProps {
  disabled: boolean;
  state: McpCopyFormState;
  onDestinationClientChange: (value: ClientKind) => void;
  onTargetIdChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  className?: string;
}

const CLIENTS: ClientKind[] = ["codex", "claude_code", "cursor"];

export function McpCopyForm({
  disabled,
  state,
  onDestinationClientChange,
  onTargetIdChange,
  onEnabledChange,
  onSubmit,
  className,
}: McpCopyFormProps) {
  const destinationOptions = CLIENTS.filter((client) => client !== state.sourceClient);

  return (
    <form
      className={cn("grid min-w-0 content-start gap-2", className)}
      onSubmit={(event) => void onSubmit(event)}
    >
      {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

      <Alert variant="default">
        Copy uses normalized transport fields only (`command`, `args`, `url`, `enabled`). Client
        specific extras (for example `env`, headers, or optional transport metadata) are not copied
        in this version.
      </Alert>

      <Label>Source</Label>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <strong>{formatClientLabel(state.sourceClient)}</strong> / {state.sourceDisplayName}
      </p>

      <Label>Transport</Label>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
        {state.transportPreview || "No transport details available"}
      </p>

      <Label htmlFor="mcp-copy-destination">Destination Client</Label>
      <select
        id="mcp-copy-destination"
        className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        value={state.destinationClient}
        onChange={(event) => onDestinationClientChange(event.currentTarget.value as ClientKind)}
        disabled={disabled || destinationOptions.length === 0}
      >
        {destinationOptions.map((client) => (
          <option key={client} value={client}>
            {formatClientLabel(client)}
          </option>
        ))}
      </select>

      <Label htmlFor="mcp-copy-target-id">Target ID</Label>
      <Input
        id="mcp-copy-target-id"
        value={state.targetId}
        onChange={(event) => onTargetIdChange(event.currentTarget.value)}
        placeholder="filesystem"
        disabled={disabled}
      />

      <label
        className="mt-1 flex items-center gap-2 text-sm text-slate-700"
        htmlFor="mcp-copy-enabled"
      >
        <input
          id="mcp-copy-enabled"
          className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          type="checkbox"
          checked={state.enabled}
          onChange={(event) => onEnabledChange(event.currentTarget.checked)}
          disabled={disabled}
        />
        Enable this MCP entry
      </label>

      <Button type="submit" disabled={disabled || destinationOptions.length === 0}>
        Copy MCP
      </Button>
    </form>
  );
}
