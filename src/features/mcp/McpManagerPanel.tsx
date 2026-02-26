import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import { formatClientLabel } from "../clients/client-labels";
import { ErrorRecoveryCallout } from "../common/ErrorRecoveryCallout";
import { ViewStatePanel } from "../common/ViewStatePanel";
import { McpAddForm } from "./components/McpAddForm";
import { McpResourceTable } from "./components/McpResourceTable";
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
    <section className="mcp-panel">
      <header className="mcp-header">
        <div>
          <h2>MCP Manager</h2>
          <p>
            Managing <strong>{formatClientLabel(client)}</strong>
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            clearFeedback();
            void refresh();
          }}
          disabled={phase === "loading"}
        >
          {phase === "loading" ? "Loading..." : "Reload MCP List"}
        </button>
      </header>

      {warning ? <p className="mcp-feedback mcp-feedback-warning">{warning}</p> : null}
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
      {feedback?.kind === "success" ? (
        <p className="mcp-feedback mcp-feedback-success">{feedback.message}</p>
      ) : null}
      {feedback?.kind === "error" && feedback.diagnostic ? (
        <ErrorRecoveryCallout title="MCP mutation failed" diagnostic={feedback.diagnostic} />
      ) : null}
      {feedback?.kind === "error" && !feedback.diagnostic ? (
        <p className="mcp-feedback mcp-feedback-error">{feedback.message}</p>
      ) : null}

      <div className="mcp-layout">
        <McpAddForm disabled={phase === "loading"} onSubmit={addMcp} />
        <McpResourceTable
          resources={resources}
          pendingRemovalId={pendingRemovalId}
          onRemove={handleRemove}
        />
      </div>
    </section>
  );
}
