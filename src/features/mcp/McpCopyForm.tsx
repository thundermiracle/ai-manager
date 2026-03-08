import type { FormEvent } from "react";

import type { ClientKind } from "../../backend/contracts";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { formatClientLabel } from "../clients/client-labels";
import type { McpMutationTargetPlan } from "./mcp-targets";
import {
  buildMcpCopyDestinationClients,
  describeMcpAction,
  type McpReplicationAction,
} from "./mcp-targets";
import type { McpCopyFormState } from "./useMcpCopyForm";

interface McpCopyFormProps {
  disabled: boolean;
  state: McpCopyFormState;
  destinationPlan: McpMutationTargetPlan;
  onModeChange: (value: McpReplicationAction) => void;
  onDestinationClientChange: (value: ClientKind) => void;
  onTargetIdChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  className?: string;
}

export function McpCopyForm({
  disabled,
  state,
  destinationPlan,
  onModeChange,
  onDestinationClientChange,
  onTargetIdChange,
  onSubmit,
  className,
}: McpCopyFormProps) {
  const destinationOptions = buildMcpCopyDestinationClients(state.sourceClient);
  const submitLabel = describeMcpAction(state.mode, destinationPlan);

  return (
    <form
      className={cn("grid min-w-0 content-start gap-2", className)}
      onSubmit={(event) => void onSubmit(event)}
    >
      {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

      <Alert variant="default">
        Replication uses normalized transport fields only (`command`, `args`, `url`, `enabled`).
        Client specific extras (for example `env`, headers, or optional transport metadata) are not
        copied in this version.
      </Alert>
      <Alert variant="default">
        <strong>{destinationPlan.destinationLabel}.</strong>{" "}
        {destinationPlan.destinationDescription}
      </Alert>
      {destinationPlan.fallbackNotice ? (
        <Alert variant="warning">{destinationPlan.fallbackNotice}</Alert>
      ) : null}

      <Label>Source</Label>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <strong>{formatClientLabel(state.sourceClient)}</strong> / {state.sourceDisplayName} from{" "}
        {state.sourceLabel}
      </p>

      <Label>Transport</Label>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
        {state.transportPreview || "No transport details available"}
      </p>

      {state.availableModes.length > 1 ? (
        <>
          <Label>Action</Label>
          <div className="grid grid-cols-2 gap-2 max-[560px]:grid-cols-1">
            <Button
              type="button"
              variant={state.mode === "copy" ? "default" : "outline"}
              onClick={() => onModeChange("copy")}
              disabled={disabled}
            >
              Copy to another client
            </Button>
            <Button
              type="button"
              variant={state.mode === "promote" ? "default" : "outline"}
              onClick={() => onModeChange("promote")}
              disabled={disabled}
            >
              Promote to personal
            </Button>
          </div>
        </>
      ) : null}

      {state.mode === "copy" ? (
        <>
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
        </>
      ) : (
        <>
          <Label>Destination</Label>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <strong>{formatClientLabel(state.sourceClient)}</strong> / Personal config
          </p>
        </>
      )}

      <Label htmlFor="mcp-copy-target-id">Target ID</Label>
      <Input
        id="mcp-copy-target-id"
        value={state.targetId}
        onChange={(event) => onTargetIdChange(event.currentTarget.value)}
        placeholder="filesystem"
        disabled={disabled}
      />

      <Button
        type="submit"
        disabled={disabled || (state.mode === "copy" && destinationOptions.length === 0)}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
