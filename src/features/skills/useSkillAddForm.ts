import { type FormEvent, useCallback, useState } from "react";

import type { AddSkillInput, SkillInstallInputKind } from "./useSkillManager";

export interface SkillAddFormState {
  targetId: string;
  installKind: SkillInstallInputKind;
  manifest: string;
  localError: string | null;
}

interface UseSkillAddFormParams {
  onSubmit: (input: AddSkillInput) => Promise<boolean>;
  onAccepted?: () => void;
}

interface UseSkillAddFormResult {
  state: SkillAddFormState;
  setTargetId: (value: string) => void;
  setInstallKind: (value: SkillInstallInputKind) => void;
  setManifest: (value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const DEFAULT_MANIFEST = `# New Skill

Describe what this skill does and how to use it.
`;

const DEFAULT_STATE: SkillAddFormState = {
  targetId: "new-skill",
  installKind: "directory",
  manifest: DEFAULT_MANIFEST,
  localError: null,
};

export function useSkillAddForm({
  onSubmit,
  onAccepted,
}: UseSkillAddFormParams): UseSkillAddFormResult {
  const [state, setState] = useState<SkillAddFormState>(DEFAULT_STATE);

  const setTargetId = useCallback((value: string) => {
    setState((current) => ({ ...current, targetId: value }));
  }, []);

  const setInstallKind = useCallback((value: SkillInstallInputKind) => {
    setState((current) => ({ ...current, installKind: value }));
  }, []);

  const setManifest = useCallback((value: string) => {
    setState((current) => ({ ...current, manifest: value }));
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setState((current) => ({ ...current, localError: null }));

      const normalizedTargetId = state.targetId.trim();
      if (normalizedTargetId.length === 0) {
        setState((current) => ({ ...current, localError: "Target ID is required." }));
        return;
      }

      if (state.manifest.trim().length === 0) {
        setState((current) => ({ ...current, localError: "Manifest content is required." }));
        return;
      }

      const accepted = await onSubmit({
        targetId: normalizedTargetId,
        manifest: state.manifest,
        installKind: state.installKind,
      });

      if (accepted) {
        setState((current) => ({ ...current, targetId: "" }));
        onAccepted?.();
      }
    },
    [onAccepted, onSubmit, state],
  );

  return {
    state,
    setTargetId,
    setInstallKind,
    setManifest,
    submit,
  };
}
