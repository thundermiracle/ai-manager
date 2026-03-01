import type { FormEvent } from "react";

import type { ClientKind } from "../../backend/contracts";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import { formatClientLabel } from "../clients/client-labels";
import type { SkillCopyFormState } from "./useSkillCopyForm";
import type { SkillInstallInputKind } from "./useSkillManager";

interface SkillCopyFormProps {
  disabled: boolean;
  state: SkillCopyFormState;
  onDestinationClientChange: (value: ClientKind) => void;
  onTargetIdChange: (value: string) => void;
  onInstallKindChange: (value: SkillInstallInputKind) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  className?: string;
}

const CLIENTS: ClientKind[] = ["codex", "claude_code", "cursor"];

export function SkillCopyForm({
  disabled,
  state,
  onDestinationClientChange,
  onTargetIdChange,
  onInstallKindChange,
  onSubmit,
  className,
}: SkillCopyFormProps) {
  const destinationOptions = CLIENTS.filter((client) => client !== state.sourceClient);

  return (
    <form
      className={cn("grid min-w-0 content-start gap-2", className)}
      onSubmit={(event) => void onSubmit(event)}
    >
      {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

      <Label>Source</Label>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <strong>{formatClientLabel(state.sourceClient)}</strong> / {state.sourceDisplayName}
      </p>

      <Label htmlFor="skill-copy-destination">Destination Client</Label>
      <select
        id="skill-copy-destination"
        className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        value={state.destinationClient}
        onChange={(event) => onDestinationClientChange(event.currentTarget.value as ClientKind)}
        disabled={disabled || destinationOptions.length === 0}
      >
        {destinationOptions.map((client) => (
          <option key={client} value={client}>
            {formatClientLabel(client)}
          </option>
        ))}
      </select>

      <Label htmlFor="skill-copy-target-id">Target ID</Label>
      <Input
        id="skill-copy-target-id"
        value={state.targetId}
        onChange={(event) => onTargetIdChange(event.currentTarget.value)}
        placeholder="python-refactor"
        disabled={disabled}
      />

      <Label htmlFor="skill-copy-install-kind">Install Kind</Label>
      <select
        id="skill-copy-install-kind"
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

      <Label htmlFor="skill-copy-manifest">Manifest Preview</Label>
      <Textarea
        id="skill-copy-manifest"
        className="min-h-[11rem] resize-y bg-slate-50"
        value={state.manifest}
        disabled
      />

      <Button type="submit" disabled={disabled || destinationOptions.length === 0}>
        Copy Skill
      </Button>
    </form>
  );
}
