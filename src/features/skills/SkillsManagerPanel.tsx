import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { formatClientLabel } from "../clients/client-labels";
import { ErrorRecoveryCallout } from "../common/ErrorRecoveryCallout";
import { ViewStatePanel } from "../common/ViewStatePanel";
import { SkillAddForm } from "./components/SkillAddForm";
import { SkillResourceTable } from "./components/SkillResourceTable";
import { useSkillManager } from "./useSkillManager";

interface SkillsManagerPanelProps {
  client: ClientKind | null;
}

export function SkillsManagerPanel({ client }: SkillsManagerPanelProps) {
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

  async function handleRemove(resource: ResourceRecord) {
    if (
      !window.confirm(
        `Remove Skill '${resource.display_name}' from ${formatClientLabel(resource.client)}?`,
      )
    ) {
      return;
    }

    await removeSkill(resource.display_name, resource.source_path);
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
    <Card className="bg-sky-50/40">
      <CardHeader className="flex-row items-start justify-between gap-3 p-4">
        <div>
          <CardTitle className="text-lg">Skills Manager</CardTitle>
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
          {phase === "loading" ? "Loading..." : "Reload Skills List"}
        </Button>
      </CardHeader>

      <CardContent className="grid gap-3 p-4 pt-0">
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
        {feedback?.kind === "success" ? <Alert variant="success">{feedback.message}</Alert> : null}
        {feedback?.kind === "error" && feedback.diagnostic ? (
          <ErrorRecoveryCallout title="Skill mutation failed" diagnostic={feedback.diagnostic} />
        ) : null}
        {feedback?.kind === "error" && !feedback.diagnostic ? (
          <Alert variant="destructive">{feedback.message}</Alert>
        ) : null}

        <div className="grid grid-cols-[minmax(14rem,18.5rem)_1fr] gap-3 max-[720px]:grid-cols-1">
          <SkillAddForm disabled={phase === "loading"} onSubmit={addSkill} />
          <SkillResourceTable
            resources={resources}
            pendingRemovalId={pendingRemovalId}
            onRemove={handleRemove}
          />
        </div>
      </CardContent>
    </Card>
  );
}
