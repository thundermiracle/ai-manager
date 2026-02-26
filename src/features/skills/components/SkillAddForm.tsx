import { type FormEvent, useState } from "react";

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
    <form className="mcp-form" onSubmit={(event) => void handleSubmit(event)}>
      <h3>Add Skill Entry</h3>

      {localError ? <p className="mcp-feedback mcp-feedback-error">{localError}</p> : null}

      <label htmlFor="skill-target-id">Target ID</label>
      <input
        id="skill-target-id"
        value={targetId}
        onChange={(event) => setTargetId(event.currentTarget.value)}
        placeholder="python-refactor"
        disabled={disabled}
      />

      <label htmlFor="skill-install-kind">Install Kind</label>
      <select
        id="skill-install-kind"
        value={installKind}
        onChange={(event) => setInstallKind(event.currentTarget.value as SkillInstallInputKind)}
        disabled={disabled}
      >
        <option value="directory">directory (target/SKILL.md)</option>
        <option value="file">file (target.md)</option>
      </select>

      <label htmlFor="skill-manifest">SKILL.md Content</label>
      <textarea
        id="skill-manifest"
        className="skills-markdown-input"
        value={manifest}
        onChange={(event) => setManifest(event.currentTarget.value)}
        disabled={disabled}
      />

      <button className="ghost-button" type="submit" disabled={disabled}>
        Add Skill
      </button>
    </form>
  );
}
