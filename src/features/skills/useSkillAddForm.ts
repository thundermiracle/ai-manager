import { type FormEvent, useCallback, useState } from "react";

import type { DiscoveredSkillCandidate } from "../../backend/contracts";
import type {
  AddSkillInput,
  GithubSkillDiscoveryResult,
  SkillInstallInputKind,
} from "./useSkillManager";

export type SkillAddMode = "manual" | "github";

export interface SkillAddFormState {
  mode: SkillAddMode;
  targetId: string;
  installKind: SkillInstallInputKind;
  manifest: string;
  githubRepoUrl: string;
  githubWarning: string | null;
  githubCandidates: DiscoveredSkillCandidate[];
  selectedGithubManifestPath: string;
  githubScanning: boolean;
  githubRiskAcknowledged: boolean;
  localError: string | null;
}

interface UseSkillAddFormParams {
  onSubmit: (input: AddSkillInput) => Promise<boolean>;
  onDiscoverGithubRepo: (githubRepoUrl: string) => Promise<GithubSkillDiscoveryResult | null>;
  onAccepted?: () => void;
}

interface UseSkillAddFormResult {
  state: SkillAddFormState;
  setMode: (value: SkillAddMode) => void;
  setTargetId: (value: string) => void;
  setInstallKind: (value: SkillInstallInputKind) => void;
  setManifest: (value: string) => void;
  setGithubRepoUrl: (value: string) => void;
  setSelectedGithubManifestPath: (value: string) => void;
  setGithubRiskAcknowledged: (value: boolean) => void;
  discoverGithubRepo: () => Promise<void>;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const DEFAULT_MANIFEST = `# New Skill

Describe what this skill does and how to use it.
`;

const DEFAULT_STATE: SkillAddFormState = {
  mode: "manual",
  targetId: "new-skill",
  installKind: "directory",
  manifest: DEFAULT_MANIFEST,
  githubRepoUrl: "",
  githubWarning: null,
  githubCandidates: [],
  selectedGithubManifestPath: "",
  githubScanning: false,
  githubRiskAcknowledged: false,
  localError: null,
};

export function useSkillAddForm({
  onSubmit,
  onDiscoverGithubRepo,
  onAccepted,
}: UseSkillAddFormParams): UseSkillAddFormResult {
  const [state, setState] = useState<SkillAddFormState>(DEFAULT_STATE);

  const setMode = useCallback((value: SkillAddMode) => {
    setState((current) => ({ ...current, mode: value, localError: null }));
  }, []);

  const setTargetId = useCallback((value: string) => {
    setState((current) => ({ ...current, targetId: value }));
  }, []);

  const setInstallKind = useCallback((value: SkillInstallInputKind) => {
    setState((current) => ({ ...current, installKind: value }));
  }, []);

  const setManifest = useCallback((value: string) => {
    setState((current) => ({ ...current, manifest: value }));
  }, []);

  const setGithubRepoUrl = useCallback((value: string) => {
    setState((current) => ({
      ...current,
      githubRepoUrl: value,
      githubCandidates: [],
      selectedGithubManifestPath: "",
      githubWarning: null,
      githubRiskAcknowledged: false,
    }));
  }, []);

  const setSelectedGithubManifestPath = useCallback((value: string) => {
    setState((current) => {
      const selected = current.githubCandidates.find((item) => item.manifest_path === value);
      return {
        ...current,
        selectedGithubManifestPath: value,
        targetId: selected?.suggested_target_id ?? current.targetId,
      };
    });
  }, []);

  const setGithubRiskAcknowledged = useCallback((value: boolean) => {
    setState((current) => ({ ...current, githubRiskAcknowledged: value }));
  }, []);

  const discoverGithubRepo = useCallback(async () => {
    const githubRepoUrl = state.githubRepoUrl.trim();
    if (githubRepoUrl.length === 0) {
      setState((current) => ({ ...current, localError: "GitHub repository URL is required." }));
      return;
    }

    setState((current) => ({ ...current, githubScanning: true, localError: null }));
    const result = await onDiscoverGithubRepo(githubRepoUrl);
    if (result === null) {
      setState((current) => ({ ...current, githubScanning: false }));
      return;
    }

    const firstCandidate = result.items[0] ?? null;
    setState((current) => ({
      ...current,
      githubRepoUrl: result.normalizedRepoUrl,
      githubWarning: result.warning,
      githubCandidates: result.items,
      selectedGithubManifestPath: firstCandidate?.manifest_path ?? "",
      targetId: firstCandidate?.suggested_target_id ?? current.targetId,
      githubScanning: false,
      githubRiskAcknowledged: false,
    }));
  }, [onDiscoverGithubRepo, state.githubRepoUrl]);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setState((current) => ({ ...current, localError: null }));

      const normalizedTargetId = state.targetId.trim();
      if (normalizedTargetId.length === 0) {
        setState((current) => ({ ...current, localError: "Target ID is required." }));
        return;
      }

      const accepted =
        state.mode === "manual"
          ? await (async () => {
              if (state.manifest.trim().length === 0) {
                setState((current) => ({
                  ...current,
                  localError: "Manifest content is required for manual mode.",
                }));
                return false;
              }
              return onSubmit({
                mode: "manual",
                targetId: normalizedTargetId,
                manifest: state.manifest,
                installKind: state.installKind,
              });
            })()
          : await (async () => {
              const normalizedGithubRepoUrl = state.githubRepoUrl.trim();
              if (normalizedGithubRepoUrl.length === 0) {
                setState((current) => ({
                  ...current,
                  localError: "GitHub repository URL is required.",
                }));
                return false;
              }
              if (state.selectedGithubManifestPath.trim().length === 0) {
                setState((current) => ({
                  ...current,
                  localError: "Select a discovered skill from the repository.",
                }));
                return false;
              }
              if (!state.githubRiskAcknowledged) {
                setState((current) => ({
                  ...current,
                  localError: "Acknowledge the risk before importing remote skills.",
                }));
                return false;
              }
              return onSubmit({
                mode: "github",
                targetId: normalizedTargetId,
                githubRepoUrl: normalizedGithubRepoUrl,
                githubSkillPath: state.selectedGithubManifestPath,
              });
            })();

      if (accepted) {
        setState(DEFAULT_STATE);
        onAccepted?.();
      }
    },
    [onAccepted, onSubmit, state],
  );

  return {
    state,
    setMode,
    setTargetId,
    setInstallKind,
    setManifest,
    setGithubRepoUrl,
    setSelectedGithubManifestPath,
    setGithubRiskAcknowledged,
    discoverGithubRepo,
    submit,
  };
}
