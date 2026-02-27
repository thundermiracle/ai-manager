import { type FormEvent, useState } from "react";

import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import type { AddSkillInput, SkillInstallInputKind } from "../useSkillManager";

interface SkillAddFormProps {
  disabled: boolean;
  onSubmit: (input: AddSkillInput) => Promise<boolean>;
}

const DEFAULT_MANIFEST = `# New Skill

Describe what this skill does and how to use it.
`;

export function SkillAddForm({ disabled, onSubmit }: SkillAddFormProps) {
  const [targetId, setTargetId] = useState("new-skill");
  const [installKind, setInstallKind] = useState<SkillInstallInputKind>("directory");
  const [manifest, setManifest] = useState(DEFAULT_MANIFEST);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    const normalizedTargetId = targetId.trim();
    if (normalizedTargetId.length === 0) {
      setLocalError("Target ID is required.");
      return;
    }

    if (manifest.trim().length === 0) {
      setLocalError("Manifest content is required.");
      return;
    }

    const accepted = await onSubmit({
      targetId: normalizedTargetId,
      manifest,
      installKind,
    });

    if (accepted) {
      setTargetId("");
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Add Skill Entry</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form className="grid content-start gap-2" onSubmit={(event) => void handleSubmit(event)}>
          {localError ? <Alert variant="destructive">{localError}</Alert> : null}

          <Label htmlFor="skill-target-id">Target ID</Label>
          <Input
            id="skill-target-id"
            value={targetId}
            onChange={(event) => setTargetId(event.currentTarget.value)}
            placeholder="python-refactor"
            disabled={disabled}
          />

          <Label htmlFor="skill-install-kind">Install Kind</Label>
          <select
            id="skill-install-kind"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            value={installKind}
            onChange={(event) => setInstallKind(event.currentTarget.value as SkillInstallInputKind)}
            disabled={disabled}
          >
            <option value="directory">directory (target/SKILL.md)</option>
            <option value="file">file (target.md)</option>
          </select>

          <Label htmlFor="skill-manifest">SKILL.md Content</Label>
          <Textarea
            id="skill-manifest"
            className="min-h-[8.2rem] resize-y"
            value={manifest}
            onChange={(event) => setManifest(event.currentTarget.value)}
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
