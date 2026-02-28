import type { FormEvent } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import type { SkillAddFormState, SkillAddMode } from "./useSkillAddForm";
import type { SkillInstallInputKind } from "./useSkillManager";

interface SkillAddFormProps {
  disabled: boolean;
  state: SkillAddFormState;
  onModeChange: (value: SkillAddMode) => void;
  onTargetIdChange: (value: string) => void;
  onInstallKindChange: (value: SkillInstallInputKind) => void;
  onManifestChange: (value: string) => void;
  onGithubRepoUrlChange: (value: string) => void;
  onSelectedGithubManifestPathChange: (value: string) => void;
  onGithubRiskAcknowledgedChange: (value: boolean) => void;
  onDiscoverGithubRepo: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  className?: string;
}

export function SkillAddForm({
  disabled,
  state,
  onModeChange,
  onTargetIdChange,
  onInstallKindChange,
  onManifestChange,
  onGithubRepoUrlChange,
  onSelectedGithubManifestPathChange,
  onGithubRiskAcknowledgedChange,
  onDiscoverGithubRepo,
  onSubmit,
  className,
}: SkillAddFormProps) {
  const selectedGithubCandidate =
    state.githubCandidates.find(
      (item) => item.manifest_path === state.selectedGithubManifestPath,
    ) ?? null;

  const form = (
    <form
      className={cn("grid min-w-0 content-start gap-2", className)}
      onSubmit={(event) => void onSubmit(event)}
    >
      {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

      <Label>Add Method</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={state.mode === "manual" ? "default" : "outline"}
          className="min-w-0 w-full"
          onClick={() => onModeChange("manual")}
          disabled={disabled}
        >
          Manual
        </Button>
        <Button
          type="button"
          variant={state.mode === "github" ? "default" : "outline"}
          className="min-w-0 w-full"
          onClick={() => onModeChange("github")}
          disabled={disabled}
        >
          GitHub URL
        </Button>
      </div>

      {state.mode === "manual" ? (
        <>
          <Label htmlFor="skill-target-id">Target ID</Label>
          <Input
            id="skill-target-id"
            value={state.targetId}
            onChange={(event) => onTargetIdChange(event.currentTarget.value)}
            placeholder="python-refactor"
            disabled={disabled}
          />

          <Label htmlFor="skill-install-kind">Install Kind</Label>
          <select
            id="skill-install-kind"
            className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            value={state.installKind}
            onChange={(event) =>
              onInstallKindChange(event.currentTarget.value as SkillInstallInputKind)
            }
            disabled={disabled}
          >
            <option value="directory">directory (target/SKILL.md)</option>
            <option value="file">file (target.md)</option>
          </select>

          <Label htmlFor="skill-manifest">SKILL.md Content</Label>
          <Textarea
            id="skill-manifest"
            className="min-h-[8.2rem] resize-y"
            value={state.manifest}
            onChange={(event) => onManifestChange(event.currentTarget.value)}
            disabled={disabled}
          />
        </>
      ) : (
        <>
          <Label htmlFor="skill-github-url">GitHub Repository URL</Label>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Input
              id="skill-github-url"
              className="min-w-0"
              value={state.githubRepoUrl}
              onChange={(event) => onGithubRepoUrlChange(event.currentTarget.value)}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void onDiscoverGithubRepo();
              }}
              className="shrink-0"
              disabled={disabled || state.githubScanning}
            >
              {state.githubScanning ? "Scanning..." : "Scan"}
            </Button>
          </div>

          {state.githubWarning ? (
            <Alert variant="warning" className="break-words">
              {state.githubWarning}
            </Alert>
          ) : null}

          {state.githubCandidates.length > 0 ? (
            <>
              <Label htmlFor="skill-github-candidate">Discovered Skills</Label>
              <select
                id="skill-github-candidate"
                className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                value={state.selectedGithubManifestPath}
                onChange={(event) => onSelectedGithubManifestPathChange(event.currentTarget.value)}
                disabled={disabled}
              >
                {state.githubCandidates.map((candidate) => (
                  <option key={candidate.manifest_path} value={candidate.manifest_path}>
                    {candidate.suggested_target_id}
                  </option>
                ))}
              </select>
              {selectedGithubCandidate ? (
                <p className="break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {selectedGithubCandidate.manifest_path}
                </p>
              ) : null}
              {selectedGithubCandidate ? (
                <Alert variant="default" className="break-words">
                  {selectedGithubCandidate.summary}
                </Alert>
              ) : null}
            </>
          ) : null}

          <Label htmlFor="skill-target-id">Target ID</Label>
          <Input
            id="skill-target-id"
            value={state.targetId}
            onChange={(event) => onTargetIdChange(event.currentTarget.value)}
            placeholder="python-refactor"
            disabled={disabled}
          />

          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={state.githubRiskAcknowledged}
              onChange={(event) => onGithubRiskAcknowledgedChange(event.currentTarget.checked)}
              disabled={disabled}
            />
            <span>
              I understand remote repository content can be unsafe, and I selected the exact skill
              to import.
            </span>
          </label>
        </>
      )}

      <Button type="submit" disabled={disabled}>
        {state.mode === "manual" ? "Add Skill" : "Import Selected Skill"}
      </Button>
    </form>
  );

  return form;
}
