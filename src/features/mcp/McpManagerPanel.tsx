import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useMemo, useState } from "react";

import type { ClientKind, ResourceRecord, ResourceViewMode } from "../../backend/contracts";
import { ConfirmModal } from "../../components/shared/ConfirmModal";
import { ErrorRecoveryCallout } from "../../components/shared/ErrorRecoveryCallout";
import { SlideOverPanel } from "../../components/shared/SlideOverPanel";
import { Snackbar } from "../../components/shared/Snackbar";
import { ViewStatePanel } from "../../components/shared/ViewStatePanel";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { formatClientLabel } from "../clients/client-labels";
import {
  buildResourceContextSummary,
  type ResourceContextMode,
} from "../resources/resource-context";
import { McpAddForm } from "./McpAddForm";
import { McpCopyForm } from "./McpCopyForm";
import { McpEditForm } from "./McpEditForm";
import { McpResourceTable } from "./McpResourceTable";
import { buildResourceTransportChecksum } from "./mcp-checksum";
import {
  buildMcpMutationTargetPlan,
  buildMcpProjectModeHint,
  describeMcpAction,
  formatResourceViewModeLabel,
  MCP_CLIENTS,
  matchesMcpDestination,
} from "./mcp-targets";
import { useMcpAddForm } from "./useMcpAddForm";
import { useMcpCopyForm } from "./useMcpCopyForm";
import { useMcpEditForm } from "./useMcpEditForm";
import { useMcpManager } from "./useMcpManager";

interface McpManagerPanelProps {
  contextMode: ResourceContextMode;
  projectRoot: string | null;
}

function toggleClientFilter(current: ClientKind[], client: ClientKind): ClientKind[] {
  if (current.includes(client)) {
    return current.length === 1 ? current : current.filter((entry) => entry !== client);
  }

  return [...current, client];
}

function includesSearchQuery(
  resource: ResourceRecord,
  normalizedQuery: string,
  shadowingSource: ResourceRecord | null,
): boolean {
  if (normalizedQuery.length === 0) {
    return true;
  }

  const haystack = [
    formatClientLabel(resource.client),
    resource.display_name,
    resource.logical_id,
    resource.transport_kind,
    resource.transport_command,
    resource.transport_url,
    resource.source_label,
    resource.source_scope,
    resource.source_path,
    shadowingSource?.source_label,
  ]
    .filter((value): value is string => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function McpManagerPanel({ contextMode, projectRoot }: McpManagerPanelProps) {
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isCopyOpen, setCopyOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [removalCandidate, setRemovalCandidate] = useState<ResourceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ResourceViewMode>("effective");
  const [clientFilters, setClientFilters] = useState<ClientKind[]>(MCP_CLIENTS);
  const contextSummary = buildResourceContextSummary({
    mode: contextMode,
    projectRoot,
  });

  const {
    phase,
    resources,
    resolvedProjectRoot,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    pendingUpdateId,
    pendingCopyId,
    addMcp,
    copyMcp,
    updateMcp,
    removeMcp,
    refresh,
    clearFeedback,
  } = useMcpManager({
    contextMode,
    projectRoot,
    viewMode,
  });

  const effectiveProjectRoot = resolvedProjectRoot ?? projectRoot;
  const resolveDestination = useCallback(
    (client: ClientKind) => buildMcpMutationTargetPlan(client, contextMode, effectiveProjectRoot),
    [contextMode, effectiveProjectRoot],
  );

  const addForm = useMcpAddForm({
    onSubmit: addMcp,
    resolveDestination,
    onAccepted: () => setComposerOpen(false),
  });
  const editForm = useMcpEditForm({
    onSubmit: updateMcp,
    onAccepted: () => setEditOpen(false),
  });
  const copyForm = useMcpCopyForm({
    onSubmit: copyMcp,
    resolveDestination,
    onAccepted: () => setCopyOpen(false),
  });

  const addDestinationPlan = useMemo(
    () => resolveDestination(addForm.state.destinationClient),
    [addForm.state.destinationClient, resolveDestination],
  );
  const copyDestinationPlan = useMemo(
    () => resolveDestination(copyForm.state.destinationClient),
    [copyForm.state.destinationClient, resolveDestination],
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const resourcesById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources],
  );
  const clientCounts = useMemo(() => {
    const counts = new Map<ClientKind, number>(MCP_CLIENTS.map((client) => [client, 0]));
    for (const resource of resources) {
      counts.set(resource.client, (counts.get(resource.client) ?? 0) + 1);
    }
    return counts;
  }, [resources]);
  const addDestinationResources = useMemo(
    () => resources.filter((resource) => matchesMcpDestination(resource, addDestinationPlan)),
    [addDestinationPlan, resources],
  );
  const existingTargetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const resource of addDestinationResources) {
      ids.add(resource.display_name.trim().toLowerCase());
    }
    return ids;
  }, [addDestinationResources]);
  const existingTransportChecksums = useMemo(() => {
    const checksums = new Set<string>();
    for (const resource of addDestinationResources) {
      const checksum = buildResourceTransportChecksum(resource);
      if (checksum) {
        checksums.add(checksum);
      }
    }
    return checksums;
  }, [addDestinationResources]);
  const filteredResources = useMemo(
    () =>
      resources.filter((resource) => {
        if (!clientFilters.includes(resource.client)) {
          return false;
        }

        return includesSearchQuery(
          resource,
          normalizedQuery,
          resource.shadowed_by ? (resourcesById.get(resource.shadowed_by) ?? null) : null,
        );
      }),
    [clientFilters, normalizedQuery, resources, resourcesById],
  );
  const snackbarFeedback = useMemo(() => {
    if (feedback === null) {
      return null;
    }
    if (feedback.kind === "error" && feedback.diagnostic) {
      return {
        tone: "error" as const,
        message: `CODE: ${feedback.diagnostic.code} | ${feedback.message}`,
      };
    }
    return {
      tone: feedback.kind === "error" ? ("error" as const) : ("success" as const),
      message: feedback.message,
    };
  }, [feedback]);

  async function handleRemove(resource: ResourceRecord) {
    setRemovalCandidate(resource);
  }

  async function handleEdit(resource: ResourceRecord) {
    clearFeedback();
    editForm.loadResource(resource, effectiveProjectRoot);
    setEditOpen(true);
  }

  async function handleCopy(resource: ResourceRecord) {
    clearFeedback();
    copyForm.loadResource(resource);
    setCopyOpen(true);
  }

  async function handleConfirmRemoval() {
    if (removalCandidate === null) {
      return;
    }

    await removeMcp({
      resourceId: removalCandidate.id,
      client: removalCandidate.client,
      targetId: removalCandidate.display_name,
      projectRoot: effectiveProjectRoot,
      targetSourceId: removalCandidate.source_id,
      sourceLabel: removalCandidate.source_label,
    });
    setRemovalCandidate(null);
  }

  function handleCancelRemoval() {
    if (pendingRemovalId !== null) {
      return;
    }

    setRemovalCandidate(null);
  }

  function openComposer() {
    clearFeedback();
    if (clientFilters.length === 1) {
      addForm.setDestinationClient(clientFilters[0]);
    }
    setComposerOpen(true);
  }

  if (contextMode === "project" && projectRoot === null) {
    return (
      <ViewStatePanel
        title="Project Context Required"
        message="Apply a project root to prepare project-aware MCP screens."
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
              <p className="mt-1 text-sm text-slate-700">{contextSummary.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatResourceViewModeLabel(viewMode)} across {clientFilters.length} client filter
                {clientFilters.length === 1 ? "" : "s"}.
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
                Add MCP Destination
              </Button>
            </div>
          </div>

          {contextMode === "project" ? (
            <Alert variant="default">{buildMcpProjectModeHint()}</Alert>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rounded-full bg-slate-900 px-3 py-1 text-[0.69rem] font-semibold uppercase tracking-[0.08em] text-slate-100">
                {filteredResources.length} shown / {resources.length} total
              </p>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(["effective", "all_sources"] as ResourceViewMode[]).map((candidateMode) => (
                  <button
                    key={candidateMode}
                    type="button"
                    className={
                      viewMode === candidateMode
                        ? "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm"
                        : "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
                    }
                    onClick={() => setViewMode(candidateMode)}
                  >
                    {formatResourceViewModeLabel(candidateMode)}
                  </button>
                ))}
              </div>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                className="h-9 max-w-[19rem] border-slate-200 bg-white max-[720px]:max-w-full"
                placeholder="Search name, transport, source label"
              />
              {normalizedQuery.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={clientFilters.length === MCP_CLIENTS.length ? "default" : "outline"}
                size="sm"
                onClick={() => setClientFilters(MCP_CLIENTS)}
              >
                All Clients
              </Button>
              {MCP_CLIENTS.map((client) => {
                const active = clientFilters.includes(client);
                return (
                  <Button
                    key={client}
                    type="button"
                    variant={active ? "secondary" : "outline"}
                    size="sm"
                    onClick={() =>
                      setClientFilters((current) => toggleClientFilter(current, client))
                    }
                  >
                    {formatClientLabel(client)} ({clientCounts.get(client) ?? 0})
                  </Button>
                );
              })}
            </div>
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

          <McpResourceTable
            resources={filteredResources}
            pendingRemovalId={pendingRemovalId}
            pendingUpdateId={pendingUpdateId}
            pendingCopyId={pendingCopyId}
            onCopy={handleCopy}
            onEdit={handleEdit}
            onRemove={handleRemove}
            emptyMessage={
              normalizedQuery.length > 0
                ? `No MCP entries match "${searchQuery.trim()}".`
                : "No MCP entries registered for the current context."
            }
          />
        </CardContent>
      </Card>

      <SlideOverPanel
        open={isComposerOpen}
        title="Add MCP Destination"
        description="Choose the destination client first, then register the MCP entry for the current context."
        panelClassName="max-w-[42rem] max-[920px]:max-w-full"
        onClose={() => setComposerOpen(false)}
      >
        <McpAddForm
          disabled={phase === "loading"}
          state={addForm.state}
          destinationClient={addForm.state.destinationClient}
          destinationLabel={addDestinationPlan.destinationLabel}
          destinationDescription={addDestinationPlan.destinationDescription}
          destinationNotice={addDestinationPlan.fallbackNotice}
          submitLabel={describeMcpAction("add", addDestinationPlan)}
          existingTargetIds={existingTargetIds}
          existingTransportChecksums={existingTransportChecksums}
          onDestinationClientChange={addForm.setDestinationClient}
          onModeChange={addForm.setMode}
          onTargetIdChange={addForm.setTargetId}
          onTransportModeChange={addForm.setTransportMode}
          onCommandChange={addForm.setCommand}
          onArgsInputChange={addForm.setArgsInput}
          onUrlChange={addForm.setUrl}
          onEnabledChange={addForm.setEnabled}
          onRegistryQueryChange={addForm.setRegistryQuery}
          onReloadRegistry={addForm.reloadRegistry}
          onApplyPreset={addForm.applyPreset}
          onOpenPresetDocs={(preset) => {
            void openUrl(preset.docsUrl);
          }}
          onSubmit={addForm.submit}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        />
      </SlideOverPanel>

      <SlideOverPanel
        open={isCopyOpen}
        title="Copy MCP to Another Client"
        description="Copy the selected MCP entry to another client using the active personal or project context."
        panelClassName="max-w-[40rem] max-[920px]:max-w-full"
        onClose={() => {
          if (pendingCopyId !== null) {
            return;
          }
          setCopyOpen(false);
          copyForm.reset();
        }}
      >
        <McpCopyForm
          disabled={phase === "loading" || pendingCopyId !== null}
          state={copyForm.state}
          destinationPlan={copyDestinationPlan}
          onDestinationClientChange={copyForm.setDestinationClient}
          onTargetIdChange={copyForm.setTargetId}
          onEnabledChange={copyForm.setEnabled}
          onSubmit={copyForm.submit}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        />
      </SlideOverPanel>

      <SlideOverPanel
        open={isEditOpen}
        title="Edit MCP Source"
        description="Update the selected MCP entry in its current source."
        panelClassName="max-w-[32rem] max-[920px]:max-w-full"
        onClose={() => {
          if (pendingUpdateId !== null) {
            return;
          }
          setEditOpen(false);
          editForm.reset();
        }}
      >
        <McpEditForm
          disabled={phase === "loading" || pendingUpdateId !== null}
          state={editForm.state}
          onTransportModeChange={editForm.setTransportMode}
          onCommandChange={editForm.setCommand}
          onArgsInputChange={editForm.setArgsInput}
          onUrlChange={editForm.setUrl}
          onEnabledChange={editForm.setEnabled}
          onSubmit={editForm.submit}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        />
      </SlideOverPanel>

      <ConfirmModal
        open={removalCandidate !== null}
        title="Remove MCP Source"
        description={
          removalCandidate ? (
            <p>
              Remove MCP <strong>{removalCandidate.display_name}</strong> from{" "}
              <strong>{removalCandidate.source_label}</strong> for{" "}
              <strong>{formatClientLabel(removalCandidate.client)}</strong>?
            </p>
          ) : (
            ""
          )
        }
        confirmLabel={pendingRemovalId === null ? "Remove from source" : "Removing..."}
        confirmDisabled={pendingRemovalId !== null}
        onConfirm={() => {
          void handleConfirmRemoval();
        }}
        onCancel={handleCancelRemoval}
      />

      <Snackbar
        open={snackbarFeedback !== null}
        tone={snackbarFeedback?.tone ?? "info"}
        message={snackbarFeedback?.message ?? ""}
        durationMs={5000}
        onClose={clearFeedback}
      />
    </>
  );
}
