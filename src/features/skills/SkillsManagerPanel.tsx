import { useMemo, useState } from "react";

import { RESOURCE_KIND_CATALOG, type ResourceRecord } from "../../backend/contracts";
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
import { listNativeResourceEntryPoints } from "./native-resource-catalog";
import { SkillAddForm } from "./SkillAddForm";
import { SkillCopyForm } from "./SkillCopyForm";
import { SkillEditForm } from "./SkillEditForm";
import { SkillResourceTable } from "./SkillResourceTable";
import { buildResourceSkillManifestChecksum } from "./skill-checksum";
import { buildSkillContextHint } from "./skill-context";
import { buildSkillGithubRecentsStorageKey } from "./skill-github-recents";
import {
  countSkillResourcesByClient,
  filterSkillResources,
  toggleSkillClientFilter,
} from "./skill-list-view";
import {
  buildSkillDestinationDescription,
  describeSkillAction,
  SKILL_CLIENTS,
} from "./skill-targets";
import { useSkillAddForm } from "./useSkillAddForm";
import { useSkillCopyForm } from "./useSkillCopyForm";
import { useSkillEditForm } from "./useSkillEditForm";
import { useSkillManager } from "./useSkillManager";

interface SkillsManagerPanelProps {
  contextMode: ResourceContextMode;
  projectRoot: string | null;
}

export function SkillsManagerPanel({ contextMode, projectRoot }: SkillsManagerPanelProps) {
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isCopyOpen, setCopyOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [removalCandidate, setRemovalCandidate] = useState<ResourceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilters, setClientFilters] = useState(SKILL_CLIENTS);
  const contextSummary = buildResourceContextSummary({
    mode: contextMode,
    projectRoot,
  });
  const contextHint = buildSkillContextHint(contextMode);

  const {
    phase,
    resources,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    pendingUpdateId,
    pendingCopyId,
    addSkill,
    copySkill,
    updateSkill,
    discoverGithubSkills,
    removeSkill,
    refresh,
    clearFeedback,
  } = useSkillManager();

  const existingSkillsById = useMemo(() => {
    const entries = new Map<
      string,
      {
        installKind: "directory" | "file";
        checksum: string | null;
      }
    >();

    for (const resource of resources) {
      const normalizedTargetId = resource.display_name.trim().toLowerCase();
      if (normalizedTargetId.length === 0) {
        continue;
      }

      entries.set(`${resource.client}::${normalizedTargetId}`, {
        installKind: resource.install_kind === "file" ? "file" : "directory",
        checksum: buildResourceSkillManifestChecksum(resource),
      });
    }

    return entries;
  }, [resources]);

  const addForm = useSkillAddForm({
    onAddSubmit: addSkill,
    onUpdateSubmit: updateSkill,
    onDiscoverGithubRepo: discoverGithubSkills,
    existingSkillsById,
    getRecentGithubRepoStorageKey: buildSkillGithubRecentsStorageKey,
    onAccepted: () => setComposerOpen(false),
  });
  const editForm = useSkillEditForm({
    onSubmit: updateSkill,
    onAccepted: () => setEditOpen(false),
  });
  const copyForm = useSkillCopyForm({
    onSubmit: copySkill,
    onAccepted: () => setCopyOpen(false),
  });

  const primaryAddLabel = useMemo(() => {
    if (clientFilters.length !== 1) {
      return "Choose add destination";
    }

    return describeSkillAction("add", clientFilters[0]);
  }, [clientFilters]);
  const addSubmitLabel = useMemo(() => {
    if (addForm.syncInfo.status === "update_available") {
      return describeSkillAction("update", addForm.state.destinationClient);
    }

    return describeSkillAction(
      addForm.state.mode === "manual" ? "add" : "import",
      addForm.state.destinationClient,
    );
  }, [addForm.state.destinationClient, addForm.state.mode, addForm.syncInfo.status]);
  const clientCounts = useMemo(() => countSkillResourcesByClient(resources), [resources]);
  const filteredResources = useMemo(
    () => filterSkillResources(resources, clientFilters, searchQuery),
    [clientFilters, resources, searchQuery],
  );
  const nativeResourceEntryPoints = useMemo(
    () =>
      clientFilters.flatMap((client) =>
        listNativeResourceEntryPoints(client).map((entryPoint) => ({
          ...entryPoint,
          client,
        })),
      ),
    [clientFilters],
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
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
    editForm.loadResource(resource);
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

    await removeSkill({
      resourceId: removalCandidate.id,
      client: removalCandidate.client,
      targetId: removalCandidate.display_name,
      sourcePath: removalCandidate.source_path,
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
        message="Apply a project root to review generic skill libraries in project mode."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(180deg,#fafbff_0%,#ffffff_38%)] shadow-[0_18px_36px_rgba(30,41,59,0.08)]">
        <CardHeader className="grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3 max-[720px]:flex-col">
            <div>
              <CardTitle className="text-[1.35rem] tracking-[-0.012em]">Skill Libraries</CardTitle>
              <p className="mt-1 text-sm text-slate-700">{contextSummary.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                {clientFilters.length === 0
                  ? "No client filters selected."
                  : `Generic skill libraries across ${clientFilters.length} selected client${clientFilters.length === 1 ? "" : "s"}.`}
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
                {primaryAddLabel}
              </Button>
            </div>
          </div>

          {contextMode === "project" ? <Alert variant="default">{contextHint}</Alert> : null}

          <section className="grid gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rounded-full bg-emerald-600 px-3 py-1 text-[0.69rem] font-semibold uppercase tracking-[0.08em] text-white">
                {RESOURCE_KIND_CATALOG.skill.family} family
              </p>
              <p className="rounded-full bg-slate-900 px-3 py-1 text-[0.69rem] font-semibold uppercase tracking-[0.08em] text-slate-100">
                AI Manager-managed
              </p>
            </div>
            <p className="text-sm text-slate-700">
              This surface manages reusable `SKILL.md` libraries only. Native client resources stay
              on dedicated surfaces so project-native features do not get folded into generic skill
              storage.
            </p>
            {nativeResourceEntryPoints.length > 0 ? (
              <div className="grid gap-2">
                {nativeResourceEntryPoints.map((entryPoint) => (
                  <div
                    key={`${entryPoint.client}:${entryPoint.id}`}
                    className="rounded-xl border border-sky-200/80 bg-sky-50/80 p-3"
                  >
                    <div className="flex items-start justify-between gap-3 max-[720px]:flex-col">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{entryPoint.title}</p>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-600">
                            {formatClientLabel(entryPoint.client)}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-600">
                          {entryPoint.description}
                        </p>
                      </div>
                      <p className="rounded-full bg-sky-600 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white">
                        {entryPoint.statusLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No native resource entry points are defined for the active client filters yet.
              </p>
            )}
          </section>

          <div className="grid gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rounded-full bg-slate-900 px-3 py-1 text-[0.69rem] font-semibold uppercase tracking-[0.08em] text-slate-100">
                {filteredResources.length} shown / {resources.length} total
              </p>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                className="h-9 max-w-[19rem] border-slate-200 bg-white max-[720px]:max-w-full"
                placeholder="Search name, client, install kind"
              />
              {normalizedQuery.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {SKILL_CLIENTS.map((client) => {
                const active = clientFilters.includes(client);
                return (
                  <Button
                    key={client}
                    type="button"
                    aria-pressed={active}
                    variant={active ? "secondary" : "outline"}
                    size="sm"
                    onClick={() =>
                      setClientFilters((current) => toggleSkillClientFilter(current, client))
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
              title="Skill list operation failed"
              diagnostic={operationError}
              retryLabel="Retry List"
              onRetry={() => {
                void refresh();
              }}
            />
          ) : null}

          <SkillResourceTable
            resources={filteredResources}
            pendingRemovalId={pendingRemovalId}
            pendingUpdateId={pendingUpdateId}
            pendingCopyId={pendingCopyId}
            onCopy={handleCopy}
            onEdit={handleEdit}
            onRemove={handleRemove}
            emptyMessage={
              clientFilters.length === 0
                ? "Select one or more clients to show generic skill entries."
                : normalizedQuery.length > 0
                  ? `No skill entries match "${searchQuery.trim()}".`
                  : "No generic skill entries are registered for the current context."
            }
          />
        </CardContent>
      </Card>

      <SlideOverPanel
        open={isComposerOpen}
        title="Add Generic Skill"
        description="Choose the destination client explicitly, then install the generic skill into that personal library while keeping the list in view."
        panelClassName="max-w-[42rem] max-[920px]:max-w-full"
        onClose={() => setComposerOpen(false)}
      >
        <div className="grid gap-3">
          <Alert variant={contextMode === "project" ? "warning" : "default"}>{contextHint}</Alert>
          <SkillAddForm
            disabled={phase === "loading"}
            state={addForm.state}
            syncInfo={addForm.syncInfo}
            destinationClient={addForm.state.destinationClient}
            destinationDescription={buildSkillDestinationDescription(
              addForm.state.destinationClient,
            )}
            submitButtonLabel={addSubmitLabel}
            onDestinationClientChange={addForm.setDestinationClient}
            onModeChange={addForm.setMode}
            onTargetIdChange={addForm.setTargetId}
            onInstallKindChange={addForm.setInstallKind}
            onManifestChange={addForm.setManifest}
            onGithubRepoUrlChange={addForm.setGithubRepoUrl}
            onApplyRecentGithubRepoUrl={addForm.applyRecentGithubRepoUrl}
            onSelectedGithubManifestPathChange={addForm.setSelectedGithubManifestPath}
            onGithubRiskAcknowledgedChange={addForm.setGithubRiskAcknowledged}
            onDiscoverGithubRepo={addForm.discoverGithubRepo}
            onSubmit={addForm.submit}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          />
        </div>
      </SlideOverPanel>

      <SlideOverPanel
        open={isCopyOpen}
        title="Copy Generic Skill to Another Client"
        description="Copy the selected skill into another client's personal generic skill library."
        panelClassName="max-w-[40rem] max-[920px]:max-w-full"
        onClose={() => {
          if (pendingCopyId !== null) {
            return;
          }
          setCopyOpen(false);
          copyForm.reset();
        }}
      >
        <div className="grid gap-3">
          <Alert variant={contextMode === "project" ? "warning" : "default"}>{contextHint}</Alert>
          <SkillCopyForm
            disabled={phase === "loading" || pendingCopyId !== null}
            state={copyForm.state}
            onDestinationClientChange={copyForm.setDestinationClient}
            onTargetIdChange={copyForm.setTargetId}
            onInstallKindChange={copyForm.setInstallKind}
            onSubmit={copyForm.submit}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          />
        </div>
      </SlideOverPanel>

      <SlideOverPanel
        open={isEditOpen}
        title="Edit Generic Skill"
        description="Update the selected skill manifest in its personal generic library."
        panelClassName="max-w-[40rem] max-[920px]:max-w-full"
        onClose={() => {
          if (pendingUpdateId !== null) {
            return;
          }
          setEditOpen(false);
          editForm.reset();
        }}
      >
        <div className="grid gap-3">
          <Alert variant={contextMode === "project" ? "warning" : "default"}>{contextHint}</Alert>
          <SkillEditForm
            disabled={phase === "loading" || pendingUpdateId !== null}
            state={editForm.state}
            onManifestChange={editForm.setManifest}
            onSubmit={editForm.submit}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          />
        </div>
      </SlideOverPanel>

      <ConfirmModal
        open={removalCandidate !== null}
        title="Remove Generic Skill"
        description={
          removalCandidate ? (
            <p>
              Remove skill <strong>{removalCandidate.display_name}</strong> from{" "}
              <strong>{formatClientLabel(removalCandidate.client)}</strong>?
            </p>
          ) : (
            ""
          )
        }
        confirmLabel={pendingRemovalId === null ? "Remove from library" : "Removing..."}
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
