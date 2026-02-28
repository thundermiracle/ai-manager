import { useCallback, useEffect, useState } from "react";

import { discoverSkillRepository, listResources, mutateResource } from "../../backend/client";
import type {
  ClientKind,
  CommandEnvelope,
  DiscoveredSkillCandidate,
  ResourceRecord,
} from "../../backend/contracts";
import { redactNullableSensitiveText, redactSensitiveText } from "../../security/redaction";
import {
  commandErrorToDiagnostic,
  type ErrorDiagnostic,
  runtimeErrorToDiagnostic,
} from "../common/errorDiagnostics";

export type SkillInstallInputKind = "directory" | "file";

export type AddSkillInput =
  | {
      mode: "manual";
      targetId: string;
      manifest: string;
      installKind: SkillInstallInputKind;
    }
  | {
      mode: "github";
      targetId: string;
      githubRepoUrl: string;
      githubSkillPath: string;
    };

export interface GithubSkillDiscoveryResult {
  normalizedRepoUrl: string;
  warning: string;
  items: DiscoveredSkillCandidate[];
}

interface MutationFeedback {
  kind: "success" | "error";
  message: string;
  diagnostic?: ErrorDiagnostic;
}

type LoadPhase = "idle" | "loading" | "ready" | "error";

interface UseSkillManagerResult {
  phase: LoadPhase;
  resources: ResourceRecord[];
  warning: string | null;
  operationError: ErrorDiagnostic | null;
  feedback: MutationFeedback | null;
  pendingRemovalId: string | null;
  refresh: () => Promise<void>;
  addSkill: (input: AddSkillInput) => Promise<boolean>;
  discoverGithubSkills: (githubRepoUrl: string) => Promise<GithubSkillDiscoveryResult | null>;
  removeSkill: (targetId: string, sourcePath: string | null) => Promise<boolean>;
  clearFeedback: () => void;
}

function envelopeErrorDiagnostic(
  envelope: CommandEnvelope<unknown>,
  fallbackMessage: string,
): ErrorDiagnostic {
  if (envelope.error) {
    return commandErrorToDiagnostic(envelope.error);
  }
  return runtimeErrorToDiagnostic(fallbackMessage);
}

function sortResources(resources: ResourceRecord[]): ResourceRecord[] {
  return [...resources].sort((left, right) => {
    if (left.display_name !== right.display_name) {
      return left.display_name.localeCompare(right.display_name);
    }
    return left.id.localeCompare(right.id);
  });
}

export function useSkillManager(client: ClientKind | null): UseSkillManagerResult {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<ErrorDiagnostic | null>(null);
  const [feedback, setFeedback] = useState<MutationFeedback | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (client === null) {
      setPhase("idle");
      setResources([]);
      setWarning(null);
      setOperationError(null);
      return;
    }

    setPhase("loading");
    setOperationError(null);

    try {
      const envelope = await listResources({
        client,
        resource_kind: "skill",
      });

      if (!envelope.ok || envelope.data === null) {
        setPhase("error");
        setOperationError(
          envelopeErrorDiagnostic(
            envelope,
            "List command failed without an explicit error payload.",
          ),
        );
        return;
      }

      setResources(sortResources(envelope.data.items));
      setWarning(redactNullableSensitiveText(envelope.data.warning));
      setOperationError(null);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      const message = error instanceof Error ? error.message : "Unknown list runtime error.";
      setOperationError(runtimeErrorToDiagnostic(message));
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addSkill = useCallback(
    async (input: AddSkillInput) => {
      if (client === null) {
        const diagnostic = runtimeErrorToDiagnostic("Select a client before adding a skill entry.");
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      try {
        const payload: Record<string, unknown> =
          input.mode === "github"
            ? {
                github_repo_url: input.githubRepoUrl.trim(),
                github_skill_path: input.githubSkillPath,
                install_kind: "directory",
              }
            : {
                manifest: input.manifest,
                install_kind: input.installKind,
              };

        const envelope = await mutateResource({
          client,
          resource_kind: "skill",
          action: "add",
          target_id: input.targetId,
          payload,
        });

        if (!envelope.ok || envelope.data === null) {
          const diagnostic = envelopeErrorDiagnostic(
            envelope,
            "Mutation command failed without an explicit error payload.",
          );
          setFeedback({ kind: "error", message: diagnostic.message, diagnostic });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        await refresh();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown add runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }
    },
    [client, refresh],
  );

  const discoverGithubSkills = useCallback(async (githubRepoUrl: string) => {
    const normalizedUrl = githubRepoUrl.trim();
    if (normalizedUrl.length === 0) {
      const diagnostic = runtimeErrorToDiagnostic("GitHub repository URL is required.");
      setFeedback({
        kind: "error",
        message: diagnostic.message,
        diagnostic,
      });
      return null;
    }

    try {
      const envelope = await discoverSkillRepository({
        github_repo_url: normalizedUrl,
      });
      if (!envelope.ok || envelope.data === null) {
        const diagnostic = envelopeErrorDiagnostic(
          envelope,
          "Discover command failed without an explicit error payload.",
        );
        setFeedback({ kind: "error", message: diagnostic.message, diagnostic });
        return null;
      }

      return {
        normalizedRepoUrl: envelope.data.normalized_repo_url,
        warning: envelope.data.warning,
        items: envelope.data.items,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown discover runtime error.";
      const diagnostic = runtimeErrorToDiagnostic(message);
      setFeedback({
        kind: "error",
        message: diagnostic.message,
        diagnostic,
      });
      return null;
    }
  }, []);

  const removeSkill = useCallback(
    async (targetId: string, sourcePath: string | null) => {
      if (client === null) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Select a client before removing a skill entry.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      setPendingRemovalId(targetId);
      try {
        const envelope = await mutateResource({
          client,
          resource_kind: "skill",
          action: "remove",
          target_id: targetId,
          payload: sourcePath ? { source_path: sourcePath } : null,
        });

        if (!envelope.ok || envelope.data === null) {
          const diagnostic = envelopeErrorDiagnostic(
            envelope,
            "Mutation command failed without an explicit error payload.",
          );
          setFeedback({ kind: "error", message: diagnostic.message, diagnostic });
          return false;
        }

        setFeedback({ kind: "success", message: redactSensitiveText(envelope.data.message) });
        await refresh();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown remove runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      } finally {
        setPendingRemovalId(null);
      }
    },
    [client, refresh],
  );

  return {
    phase,
    resources,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    refresh,
    addSkill,
    discoverGithubSkills,
    removeSkill,
    clearFeedback: () => setFeedback(null),
  };
}
