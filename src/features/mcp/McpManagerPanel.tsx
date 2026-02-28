import { useMemo, useState } from "react";

import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import { ErrorRecoveryCallout } from "../../components/shared/ErrorRecoveryCallout";
import { SlideOverPanel } from "../../components/shared/SlideOverPanel";
import { ViewStatePanel } from "../../components/shared/ViewStatePanel";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { formatClientLabel } from "../clients/client-labels";
import { McpAddForm } from "./McpAddForm";
import { McpResourceTable } from "./McpResourceTable";
import { useMcpAddForm } from "./useMcpAddForm";
import { useMcpManager } from "./useMcpManager";

interface McpManagerPanelProps {
  client: ClientKind | null;
}

export function McpManagerPanel({ client }: McpManagerPanelProps) {
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const addForm = useMcpAddForm({
    onSubmit: addMcp,
    onAccepted: () => setComposerOpen(false),
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredResources = useMemo(() => {
    if (normalizedQuery.length === 0) {
      return resources;
    }

    return resources.filter((resource) => {
      const haystack = [
        resource.display_name,
        resource.transport_kind,
        resource.source_path,
        resource.id,
      ]
        .filter((value): value is string => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, resources]);

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

  function openComposer() {
    clearFeedback();
    setComposerOpen(true);
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
    <>
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_38%)] shadow-[0_18px_36px_rgba(30,41,59,0.08)]">
        <CardHeader className="grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3 max-[720px]:flex-col">
            <div>
              <CardTitle className="text-[1.35rem] tracking-[-0.012em]">MCP Manager</CardTitle>
              <p className="mt-1 text-sm text-slate-700">
                Managing <strong>{formatClientLabel(client)}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  clearFeedback();
                  void refresh();
                }}
                disabled={phase === "loading"}
              >
                {phase === "loading" ? "Loading..." : "Reload"}
              </Button>
              <Button type="button" size="sm" onClick={openComposer}>
                Add MCP
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 p-2.5">
            <p className="rounded-full bg-slate-900 px-3 py-1 text-[0.69rem] font-semibold uppercase tracking-[0.08em] text-slate-100">
              {resources.length} entries
            </p>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              className="h-9 max-w-[19rem] border-slate-200 bg-white max-[720px]:max-w-full"
              placeholder="Search name, transport, source path"
            />
            {normalizedQuery.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                Clear
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 p-5 pt-0">
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
          {feedback?.kind === "success" ? (
            <Alert variant="success" className="border-emerald-300/80 bg-emerald-50/75">
              {feedback.message}
            </Alert>
          ) : null}
          {feedback?.kind === "error" && feedback.diagnostic ? (
            <ErrorRecoveryCallout title="MCP mutation failed" diagnostic={feedback.diagnostic} />
          ) : null}
          {feedback?.kind === "error" && !feedback.diagnostic ? (
            <Alert variant="destructive">{feedback.message}</Alert>
          ) : null}

          <McpResourceTable
            resources={filteredResources}
            pendingRemovalId={pendingRemovalId}
            onRemove={handleRemove}
            emptyMessage={
              normalizedQuery.length > 0
                ? `No MCP entries match "${searchQuery.trim()}".`
                : "No MCP entries registered for the selected client."
            }
          />
        </CardContent>
      </Card>

      <SlideOverPanel
        open={isComposerOpen}
        title="Add MCP Entry"
        description="Use compact input fields to register a new MCP source without leaving the list."
        onClose={() => setComposerOpen(false)}
      >
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
          framed={false}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        />
      </SlideOverPanel>
    </>
  );
}
