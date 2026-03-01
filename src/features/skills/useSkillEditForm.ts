import { type FormEvent, useCallback, useState } from "react";

import type { ResourceRecord } from "../../backend/contracts";
import type { SkillInstallInputKind, UpdateSkillInput } from "./useSkillManager";

export interface SkillEditFormState {
  targetId: string;
  installKind: SkillInstallInputKind;
  manifest: string;
  localError: string | null;
}

interface UseSkillEditFormParams {
  onSubmit: (input: UpdateSkillInput) => Promise<boolean>;
  onAccepted?: () => void;
}

interface UseSkillEditFormResult {
  state: SkillEditFormState;
  loadResource: (resource: ResourceRecord) => void;
  reset: () => void;
  setManifest: (value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const DEFAULT_MANIFEST = `# Updated Skill

Describe what changed in this skill.
`;

const DEFAULT_STATE: SkillEditFormState = {
  targetId: "",
  installKind: "directory",
  manifest: DEFAULT_MANIFEST,
  localError: null,
};

export function useSkillEditForm({
  onSubmit,
  onAccepted,
}: UseSkillEditFormParams): UseSkillEditFormResult {
  const [state, setState] = useState<SkillEditFormState>(DEFAULT_STATE);

  const loadResource = useCallback((resource: ResourceRecord) => {
    const installKind: SkillInstallInputKind =
      resource.install_kind === "file" ? "file" : "directory";

    setState({
      targetId: resource.display_name,
      installKind,
      manifest:
        resource.manifest_content && resource.manifest_content.trim().length > 0
          ? resource.manifest_content
          : DEFAULT_MANIFEST,
      localError: null,
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
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
        installKind: state.installKind,
        manifest: state.manifest,
      });

      if (accepted) {
        onAccepted?.();
      }
    },
    [onAccepted, onSubmit, state],
  );

  return {
    state,
    loadResource,
    reset,
    setManifest,
    submit,
  };
}
