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
import { SkillAddForm } from "./SkillAddForm";
import { SkillResourceTable } from "./SkillResourceTable";
import { useSkillAddForm } from "./useSkillAddForm";
import { useSkillManager } from "./useSkillManager";

interface SkillsManagerPanelProps {
  client: ClientKind | null;
}

export function SkillsManagerPanel({ client }: SkillsManagerPanelProps) {
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [removalCandidate, setRemovalCandidate] = useState<ResourceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    phase,
    resources,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    addSkill,
    removeSkill,
    refresh,
    clearFeedback,
  } = useSkillManager(client);

  const addForm = useSkillAddForm({
    onSubmit: addSkill,
    onAccepted: () => setComposerOpen(false),
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const transientFeedback =
    feedback !== null &&
    (feedback.kind === "success" || (feedback.kind === "error" && !feedback.diagnostic))
      ? feedback
      : null;
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

  async function handleConfirmRemoval() {
    if (removalCandidate === null) {
      return;
    }

    await removeSkill(removalCandidate.display_name, null);
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

  return (
    <>
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(180deg,#fafbff_0%,#ffffff_38%)] shadow-[0_18px_36px_rgba(30,41,59,0.08)]">
        <CardHeader className="grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3 max-[720px]:flex-col">
            <div>
              <CardTitle className="text-[1.35rem] tracking-[-0.012em]">Skills Manager</CardTitle>
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
                Add Skill
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
          {feedback?.kind === "error" && feedback.diagnostic ? (
            <ErrorRecoveryCallout title="Skill mutation failed" diagnostic={feedback.diagnostic} />
          ) : null}

          <SkillResourceTable
            resources={filteredResources}
            pendingRemovalId={pendingRemovalId}
            onRemove={handleRemove}
            emptyMessage={
              normalizedQuery.length > 0
                ? `No skill entries match "${searchQuery.trim()}".`
                : "No Skill entries registered for the selected client."
            }
          />
        </CardContent>
      </Card>

      <SlideOverPanel
        open={isComposerOpen}
        title="Add Skill Entry"
        description="Install a skill from a compact composer while keeping the list in view."
        onClose={() => setComposerOpen(false)}
      >
        <SkillAddForm
          disabled={phase === "loading"}
          state={addForm.state}
          onTargetIdChange={addForm.setTargetId}
          onInstallKindChange={addForm.setInstallKind}
          onManifestChange={addForm.setManifest}
          onSubmit={addForm.submit}
          framed={false}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        />
      </SlideOverPanel>

      <ConfirmModal
        open={removalCandidate !== null}
        title="Remove Skill Entry"
        description={
          removalCandidate ? (
            <p>
              Remove Skill <strong>{removalCandidate.display_name}</strong> from{" "}
              <strong>{formatClientLabel(removalCandidate.client)}</strong>?
            </p>
          ) : (
            ""
          )
        }
        confirmLabel={pendingRemovalId === null ? "Remove Skill" : "Removing..."}
        confirmDisabled={pendingRemovalId !== null}
        onConfirm={() => {
          void handleConfirmRemoval();
        }}
        onCancel={handleCancelRemoval}
      />

      <Snackbar
        open={transientFeedback !== null}
        tone={transientFeedback?.kind === "error" ? "error" : "success"}
        message={transientFeedback?.message ?? ""}
        durationMs={5000}
        onClose={clearFeedback}
      />
    </>
  );
}
