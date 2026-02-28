import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import { ErrorRecoveryCallout } from "../../components/shared/ErrorRecoveryCallout";
import { ViewStatePanel } from "../../components/shared/ViewStatePanel";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { formatClientLabel } from "../clients/client-labels";
import { McpAddForm } from "./McpAddForm";
import { McpResourceTable } from "./McpResourceTable";
import { useMcpAddForm } from "./useMcpAddForm";
import { useMcpManager } from "./useMcpManager";

interface McpManagerPanelProps {
  client: ClientKind | null;
}

export function McpManagerPanel({ client }: McpManagerPanelProps) {
  const {
    phase,
    resources,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    addMcp,
    removeMcp,
    refresh,
    clearFeedback,
  } = useMcpManager(client);
  const addForm = useMcpAddForm({ onSubmit: addMcp });

  async function handleRemove(resource: ResourceRecord) {
    if (
      !window.confirm(
        `Remove MCP '${resource.display_name}' from ${formatClientLabel(resource.client)}?`,
      )
    ) {
      return;
    }

    await removeMcp(resource.display_name, resource.source_path);
  }

  if (client === null) {
    return (
      <ViewStatePanel
        title="Client Selection Required"
        message="Select a client to list and mutate MCP entries."
      />
    );
  }

  return (
    <Card className="bg-sky-50/40">
      <CardHeader className="flex-row items-start justify-between gap-3 p-4">
        <div>
          <CardTitle className="text-lg">MCP Manager</CardTitle>
          <p className="mt-1 text-sm text-slate-700">
            Managing <strong>{formatClientLabel(client)}</strong>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            clearFeedback();
            void refresh();
          }}
          disabled={phase === "loading"}
        >
          {phase === "loading" ? "Loading..." : "Reload MCP List"}
        </Button>
      </CardHeader>

      <CardContent className="grid gap-3 p-4 pt-0">
        {warning ? <Alert variant="warning">{warning}</Alert> : null}
        {operationError ? (
          <ErrorRecoveryCallout
            title="MCP list operation failed"
            diagnostic={operationError}
            retryLabel="Retry List"
            onRetry={() => {
              void refresh();
            }}
          />
        ) : null}
        {feedback?.kind === "success" ? <Alert variant="success">{feedback.message}</Alert> : null}
        {feedback?.kind === "error" && feedback.diagnostic ? (
          <ErrorRecoveryCallout title="MCP mutation failed" diagnostic={feedback.diagnostic} />
        ) : null}
        {feedback?.kind === "error" && !feedback.diagnostic ? (
          <Alert variant="destructive">{feedback.message}</Alert>
        ) : null}

        <div className="grid grid-cols-[minmax(14rem,18.5rem)_1fr] gap-3 max-[720px]:grid-cols-1">
          <McpAddForm
            disabled={phase === "loading"}
            state={addForm.state}
            onTargetIdChange={addForm.setTargetId}
            onTransportModeChange={addForm.setTransportMode}
            onCommandChange={addForm.setCommand}
            onArgsInputChange={addForm.setArgsInput}
            onUrlChange={addForm.setUrl}
            onEnabledChange={addForm.setEnabled}
            onSubmit={addForm.submit}
          />
          <McpResourceTable
            resources={resources}
            pendingRemovalId={pendingRemovalId}
            onRemove={handleRemove}
          />
        </div>
      </CardContent>
    </Card>
  );
}
