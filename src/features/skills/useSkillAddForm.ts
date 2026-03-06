import { type FormEvent, useCallback, useMemo, useState } from "react";

import type { DiscoveredSkillCandidate } from "../../backend/contracts";
import { buildSkillManifestChecksum } from "./skill-checksum";
import type {
  AddSkillInput,
  GithubSkillDiscoveryResult,
  SkillInstallInputKind,
  UpdateSkillInput,
} from "./useSkillManager";

export type SkillAddMode = "manual" | "github";

export interface ExistingSkillRecord {
  installKind: SkillInstallInputKind;
  checksum: string | null;
}

export type SkillSyncStatus = "new" | "update_available" | "up_to_date";

export interface SkillSyncInfo {
  status: SkillSyncStatus;
  existingInstallKind: SkillInstallInputKind | null;
}

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
  onAddSubmit: (input: AddSkillInput) => Promise<boolean>;
  onUpdateSubmit: (input: UpdateSkillInput) => Promise<boolean>;
  onDiscoverGithubRepo: (githubRepoUrl: string) => Promise<GithubSkillDiscoveryResult | null>;
  onAccepted?: () => void;
  existingSkillsById?: ReadonlyMap<string, ExistingSkillRecord>;
}

interface UseSkillAddFormResult {
  state: SkillAddFormState;
  syncInfo: SkillSyncInfo;
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

function normalizeTargetId(value: string): string {
  return value.trim().toLowerCase();
}

function selectedGithubCandidate(state: SkillAddFormState): DiscoveredSkillCandidate | null {
  return (
    state.githubCandidates.find(
      (item) => item.manifest_path === state.selectedGithubManifestPath,
    ) ?? null
  );
}

function resolveIncomingChecksum(state: SkillAddFormState): string | null {
  if (state.mode === "manual") {
    if (state.manifest.trim().length === 0) {
      return null;
    }
    return buildSkillManifestChecksum(state.manifest);
  }
  return selectedGithubCandidate(state)?.manifest_checksum ?? null;
}

function resolveSyncInfo(
  state: SkillAddFormState,
  existingSkillsById: ReadonlyMap<string, ExistingSkillRecord> | undefined,
): SkillSyncInfo {
  const normalizedTargetId = normalizeTargetId(state.targetId);
  if (normalizedTargetId.length === 0 || existingSkillsById === undefined) {
    return { status: "new", existingInstallKind: null };
  }

  const existing = existingSkillsById.get(normalizedTargetId);
  if (!existing) {
    return { status: "new", existingInstallKind: null };
  }

  const incomingChecksum = resolveIncomingChecksum(state);
  if (
    incomingChecksum !== null &&
    existing.checksum !== null &&
    incomingChecksum === existing.checksum
  ) {
    return { status: "up_to_date", existingInstallKind: existing.installKind };
  }

  return { status: "update_available", existingInstallKind: existing.installKind };
}

export function useSkillAddForm({
  onAddSubmit,
  onUpdateSubmit,
  onDiscoverGithubRepo,
  onAccepted,
  existingSkillsById,
}: UseSkillAddFormParams): UseSkillAddFormResult {
  const [state, setState] = useState<SkillAddFormState>(DEFAULT_STATE);
  const syncInfo = useMemo(
    () => resolveSyncInfo(state, existingSkillsById),
    [existingSkillsById, state],
  );

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

      const currentSyncInfo = resolveSyncInfo(state, existingSkillsById);
      if (currentSyncInfo.status === "up_to_date") {
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
              return currentSyncInfo.status === "update_available"
                ? onUpdateSubmit({
                    mode: "manual",
                    targetId: normalizedTargetId,
                    manifest: state.manifest,
                    installKind: currentSyncInfo.existingInstallKind ?? state.installKind,
                  })
                : onAddSubmit({
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
              return currentSyncInfo.status === "update_available"
                ? onUpdateSubmit({
                    mode: "github",
                    targetId: normalizedTargetId,
                    githubRepoUrl: normalizedGithubRepoUrl,
                    githubSkillPath: state.selectedGithubManifestPath,
                    installKind: currentSyncInfo.existingInstallKind ?? "directory",
                  })
                : onAddSubmit({
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
    [existingSkillsById, onAccepted, onAddSubmit, onUpdateSubmit, state],
  );

  return {
    state,
    syncInfo,
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
