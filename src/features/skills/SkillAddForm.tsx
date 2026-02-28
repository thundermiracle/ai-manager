import type { FormEvent } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import type { SkillAddFormState } from "./useSkillAddForm";
import type { SkillInstallInputKind } from "./useSkillManager";

interface SkillAddFormProps {
  disabled: boolean;
  state: SkillAddFormState;
  onTargetIdChange: (value: string) => void;
  onInstallKindChange: (value: SkillInstallInputKind) => void;
  onManifestChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function SkillAddForm({
  disabled,
  state,
  onTargetIdChange,
  onInstallKindChange,
  onManifestChange,
  onSubmit,
}: SkillAddFormProps) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Add Skill Entry</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form className="grid content-start gap-2" onSubmit={(event) => void onSubmit(event)}>
          {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

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
            className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
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

          <Button variant="outline" type="submit" disabled={disabled}>
            Add Skill
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
