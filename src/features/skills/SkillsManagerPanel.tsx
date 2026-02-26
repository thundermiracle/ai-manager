import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import { formatClientLabel } from "../clients/client-labels";
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
    <section className="mcp-panel">
      <header className="mcp-header">
        <div>
          <h2>Skills Manager</h2>
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
          {phase === "loading" ? "Loading..." : "Reload Skills List"}
        </button>
      </header>

      {warning ? <p className="mcp-feedback mcp-feedback-warning">{warning}</p> : null}
      {operationError ? <p className="mcp-feedback mcp-feedback-error">{operationError}</p> : null}
      {feedback ? (
        <p
          className={
            feedback.kind === "success"
              ? "mcp-feedback mcp-feedback-success"
              : "mcp-feedback mcp-feedback-error"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="mcp-layout">
        <SkillAddForm disabled={phase === "loading"} onSubmit={addSkill} />
        <SkillResourceTable
          resources={resources}
          pendingRemovalId={pendingRemovalId}
          onRemove={handleRemove}
        />
      </div>
    </section>
  );
}
