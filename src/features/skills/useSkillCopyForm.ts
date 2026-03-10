import { type FormEvent, useCallback, useState } from "react";

import type { ClientKind, ResourceRecord } from "../../backend/contracts";
import { buildSkillCopyDestinationClients } from "./skill-targets";
import type { CopySkillInput, SkillInstallInputKind } from "./useSkillManager";

export interface SkillCopyFormState {
  sourceResourceId: string;
  sourceClient: ClientKind;
  sourceDisplayName: string;
  destinationClient: ClientKind;
  targetId: string;
  installKind: SkillInstallInputKind;
  manifest: string;
  localError: string | null;
}

interface UseSkillCopyFormParams {
  onSubmit: (input: CopySkillInput) => Promise<boolean>;
  onAccepted?: () => void;
}

interface UseSkillCopyFormResult {
  state: SkillCopyFormState;
  loadResource: (resource: ResourceRecord) => void;
  reset: () => void;
  setDestinationClient: (value: ClientKind) => void;
  setTargetId: (value: string) => void;
  setInstallKind: (value: SkillInstallInputKind) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

function pickDefaultDestination(sourceClient: ClientKind): ClientKind {
  return buildSkillCopyDestinationClients(sourceClient)[0] ?? sourceClient;
}

const DEFAULT_STATE: SkillCopyFormState = {
  sourceResourceId: "",
  sourceClient: "codex",
  sourceDisplayName: "",
  destinationClient: "claude_code",
  targetId: "",
  installKind: "directory",
  manifest: "",
  localError: null,
};

export function useSkillCopyForm({
  onSubmit,
  onAccepted,
}: UseSkillCopyFormParams): UseSkillCopyFormResult {
  const [state, setState] = useState<SkillCopyFormState>(DEFAULT_STATE);

  const loadResource = useCallback((resource: ResourceRecord) => {
    const sourceClient = resource.client;
    const installKind: SkillInstallInputKind =
      resource.install_kind === "file" ? "file" : "directory";

    setState({
      sourceResourceId: resource.id,
      sourceClient,
      sourceDisplayName: resource.display_name,
      destinationClient: pickDefaultDestination(sourceClient),
      targetId: resource.display_name,
      installKind,
      manifest:
        resource.manifest_content && resource.manifest_content.trim().length > 0
          ? resource.manifest_content
          : "",
      localError: null,
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const setDestinationClient = useCallback((value: ClientKind) => {
    setState((current) => ({
      ...current,
      destinationClient: value,
      localError: null,
    }));
  }, []);

  const setTargetId = useCallback((value: string) => {
    setState((current) => ({ ...current, targetId: value }));
  }, []);

  const setInstallKind = useCallback((value: SkillInstallInputKind) => {
    setState((current) => ({ ...current, installKind: value }));
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setState((current) => ({ ...current, localError: null }));

      if (state.sourceResourceId.length === 0) {
        setState((current) => ({ ...current, localError: "Select a source skill first." }));
        return;
      }

      const normalizedTargetId = state.targetId.trim();
      if (normalizedTargetId.length === 0) {
        setState((current) => ({ ...current, localError: "Target ID is required." }));
        return;
      }

      if (state.destinationClient === state.sourceClient) {
        setState((current) => ({
          ...current,
          localError: "Choose a destination client different from the source client.",
        }));
        return;
      }

      if (state.manifest.trim().length === 0) {
        setState((current) => ({
          ...current,
          localError: "Manifest content is unavailable for this skill. Reload and retry.",
        }));
        return;
      }

      const accepted = await onSubmit({
        sourceClient: state.sourceClient,
        sourceResourceId: state.sourceResourceId,
        destinationClient: state.destinationClient,
        targetId: normalizedTargetId,
        manifest: state.manifest,
        installKind: state.installKind,
      });

      if (accepted) {
        setState(DEFAULT_STATE);
        onAccepted?.();
      }
    },
    [onAccepted, onSubmit, state],
  );

  return {
    state,
    loadResource,
    reset,
    setDestinationClient,
    setTargetId,
    setInstallKind,
    submit,
  };
}
