import type { FormEvent } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import type { SkillEditFormState } from "./useSkillEditForm";

interface SkillEditFormProps {
  disabled: boolean;
  state: SkillEditFormState;
  onManifestChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  className?: string;
}

export function SkillEditForm({
  disabled,
  state,
  onManifestChange,
  onSubmit,
  className,
}: SkillEditFormProps) {
  return (
    <form
      className={cn("grid min-w-0 content-start gap-2", className)}
      onSubmit={(event) => void onSubmit(event)}
    >
      {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

      <Label htmlFor="skill-edit-target-id">Target ID</Label>
      <Input id="skill-edit-target-id" value={state.targetId} disabled />

      <Label htmlFor="skill-edit-install-kind">Install Kind</Label>
      <Input id="skill-edit-install-kind" value={state.installKind} disabled />

      <Label htmlFor="skill-edit-manifest">SKILL.md Content</Label>
      <Textarea
        id="skill-edit-manifest"
        className="min-h-[10rem] resize-y"
        value={state.manifest}
        onChange={(event) => onManifestChange(event.currentTarget.value)}
        disabled={disabled}
      />

      <Button type="submit" disabled={disabled}>
        Update Skill
      </Button>
    </form>
  );
}
