import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";

import {
  buildResourceContextSummary,
  normalizeProjectRootInput,
  type ResourceContextMode,
} from "./resource-context";

interface ResourceContextBarProps {
  mode: ResourceContextMode;
  draftProjectRoot: string;
  projectRoot: string | null;
  onModeChange: (mode: ResourceContextMode) => void;
  onDraftProjectRootChange: (value: string) => void;
  onApplyProjectRoot: () => void;
  onClearProjectRoot: () => void;
}

const MODES: ResourceContextMode[] = ["personal", "project"];

export function ResourceContextBar({
  mode,
  draftProjectRoot,
  projectRoot,
  onModeChange,
  onDraftProjectRootChange,
  onApplyProjectRoot,
  onClearProjectRoot,
}: ResourceContextBarProps) {
  const summary = buildResourceContextSummary({ mode, projectRoot });
  const normalizedDraftProjectRoot = normalizeProjectRootInput(draftProjectRoot);
  const canApplyProjectRoot =
    mode === "project" &&
    normalizedDraftProjectRoot !== null &&
    normalizedDraftProjectRoot !== projectRoot;

  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f7fafc_100%)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.09em] text-slate-500">
            Resource Context
          </p>
          <h3 className="text-sm font-semibold text-slate-900">{summary.title}</h3>
          <p className="text-sm text-slate-700">{summary.description}</p>
        </div>

        <div
          className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
          role="tablist"
          aria-label="Resource Context Mode"
        >
          {MODES.map((candidateMode) => (
            <button
              key={candidateMode}
              type="button"
              role="tab"
              aria-selected={mode === candidateMode}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                mode === candidateMode
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
              onClick={() => onModeChange(candidateMode)}
            >
              {candidateMode === "personal" ? "Personal" : "Project"}
            </button>
          ))}
        </div>
      </div>

      {mode === "project" ? (
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              value={draftProjectRoot}
              onChange={(event) => onDraftProjectRootChange(event.currentTarget.value)}
              placeholder="/Users/fengliu/Code/ai-manager"
              aria-label="Project root"
            />
            <Button
              type="button"
              variant="outline"
              onClick={onApplyProjectRoot}
              disabled={!canApplyProjectRoot}
            >
              Apply Project
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClearProjectRoot}
              disabled={draftProjectRoot.length === 0 && projectRoot === null}
            >
              Clear
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            Project mode keeps the current client workflow for now, while preparing project-aware
            resource views and destination selection.
          </p>
        </div>
      ) : null}
    </section>
  );
}
