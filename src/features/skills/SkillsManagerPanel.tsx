import { useMemo, useState } from "react";

import type { ClientKind, ResourceRecord } from "../../backend/contracts";
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
  isProjectContextIncomplete,
  type ResourceContextMode,
} from "../resources/resource-context";
import { SkillAddForm } from "./SkillAddForm";
import { SkillCopyForm } from "./SkillCopyForm";
import { SkillEditForm } from "./SkillEditForm";
import { SkillResourceTable } from "./SkillResourceTable";
import { buildResourceSkillManifestChecksum } from "./skill-checksum";
import { buildSkillContextHint } from "./skill-context";
import { buildSkillGithubRecentsStorageKey } from "./skill-github-recents";
import { useSkillAddForm } from "./useSkillAddForm";
import { useSkillCopyForm } from "./useSkillCopyForm";
import { useSkillEditForm } from "./useSkillEditForm";
import { useSkillManager } from "./useSkillManager";

interface SkillsManagerPanelProps {
  client: ClientKind | null;
  contextMode: ResourceContextMode;
  projectRoot: string | null;
}

export function SkillsManagerPanel({ client, contextMode, projectRoot }: SkillsManagerPanelProps) {
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isCopyOpen, setCopyOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [removalCandidate, setRemovalCandidate] = useState<ResourceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const contextSummary = buildResourceContextSummary({
    mode: contextMode,
    projectRoot,
  });
  const contextHint = buildSkillContextHint(contextMode);
  const activeClient = isProjectContextIncomplete({ mode: contextMode, projectRoot })
    ? null
    : client;

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
  } = useSkillManager(activeClient);

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
      entries.set(normalizedTargetId, {
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
    recentGithubRepoStorageKey: client ? buildSkillGithubRecentsStorageKey(client) : undefined,
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
  const filteredResources = useMemo(() => {
    if (normalizedQuery.length === 0) {
      return resources;
    }

    return resources.filter((resource) => {
      const haystack = [
        resource.display_name,
        resource.install_kind,
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

    await removeSkill(removalCandidate.display_name, removalCandidate.source_path);
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
    setComposerOpen(true);
  }

  if (client === null) {
    return (
      <ViewStatePanel
        title="Client Selection Required"
        message="Select a client to list and mutate skill entries."
      />
    );
  }

  if (contextMode === "project" && projectRoot === null) {
    return (
      <ViewStatePanel
        title="Project Context Required"
        message="Apply a project root to prepare project-aware Skills screens."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(180deg,#fafbff_0%,#ffffff_38%)] shadow-[0_18px_36px_rgba(30,41,59,0.08)]">
        <CardHeader className="grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3 max-[720px]:flex-col">
            <div>
              <CardTitle className="text-[1.35rem] tracking-[-0.012em]">Skills Manager</CardTitle>
              <p className="mt-1 text-sm text-slate-700">
                Managing personal skills for <strong>{formatClientLabel(client)}</strong>
              </p>
              <p className="mt-1 text-xs text-slate-500">{contextSummary.description}</p>
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
                Add Personal Skill
              </Button>
            </div>
          </div>

          {contextMode === "project" ? <Alert variant="warning">{contextHint}</Alert> : null}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 p-2.5">
            <p className="rounded-full bg-slate-900 px-3 py-1 text-[0.69rem] font-semibold uppercase tracking-[0.08em] text-slate-100">
              {resources.length} entries
            </p>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              className="h-9 max-w-[19rem] border-slate-200 bg-white max-[720px]:max-w-full"
              placeholder="Search name, install kind, source path"
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
              title="Skills list operation failed"
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
              normalizedQuery.length > 0
                ? `No skill entries match "${searchQuery.trim()}".`
                : contextMode === "project"
                  ? "No personal skill entries are available for the selected client in this project context."
                  : "No skill entries registered for the selected client."
            }
          />
        </CardContent>
      </Card>

      <SlideOverPanel
        open={isComposerOpen}
        title="Add Personal Skill"
        description="Install a skill into the selected client's personal storage while keeping the list in view."
        panelClassName="max-w-[42rem] max-[920px]:max-w-full"
        onClose={() => setComposerOpen(false)}
      >
        <div className="grid gap-3">
          <Alert variant={contextMode === "project" ? "warning" : "default"}>{contextHint}</Alert>
          <SkillAddForm
            disabled={phase === "loading"}
            state={addForm.state}
            syncInfo={addForm.syncInfo}
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
        title="Copy Skill to Another Client"
        description="Copy the selected skill into another client's personal skill storage."
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
        title="Edit Personal Skill"
        description="Update the selected skill manifest in the client's personal storage."
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
        title="Remove Personal Skill"
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
        confirmLabel={pendingRemovalId === null ? "Remove from personal" : "Removing..."}
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
