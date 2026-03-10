import { useCallback, useEffect, useState } from "react";

import { discoverSkillRepository, listResources, mutateResource } from "../../backend/client";
import type {
  ClientKind,
  CommandEnvelope,
  DiscoveredSkillCandidate,
  ResourceRecord,
} from "../../backend/contracts";
import { redactNullableSensitiveText, redactSensitiveText } from "../../security/redaction";
import { formatClientLabel } from "../clients/client-labels";
import {
  commandErrorToDiagnostic,
  type ErrorDiagnostic,
  runtimeErrorToDiagnostic,
} from "../common/errorDiagnostics";
import { sortSkillResources } from "./skill-list-view";
import { SKILL_CLIENTS } from "./skill-targets";

export type SkillInstallInputKind = "directory" | "file";

export type AddSkillInput =
  | {
      destinationClient: ClientKind;
      mode: "manual";
      targetId: string;
      manifest: string;
      installKind: SkillInstallInputKind;
    }
  | {
      destinationClient: ClientKind;
      mode: "github";
      targetId: string;
      githubRepoUrl: string;
      githubSkillPath: string;
    };

export type UpdateSkillInput =
  | {
      client: ClientKind;
      resourceId: string;
      mode: "manual";
      targetId: string;
      manifest: string;
      installKind: SkillInstallInputKind;
    }
  | {
      client: ClientKind;
      resourceId: string;
      mode: "github";
      targetId: string;
      githubRepoUrl: string;
      githubSkillPath: string;
      installKind: SkillInstallInputKind;
    };

export interface CopySkillInput {
  sourceClient: ClientKind;
  sourceResourceId: string;
  destinationClient: ClientKind;
  targetId: string;
  manifest: string;
  installKind: SkillInstallInputKind;
}

export interface RemoveSkillInput {
  resourceId: string;
  client: ClientKind;
  targetId: string;
  sourcePath: string | null;
}

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
  pendingUpdateId: string | null;
  pendingCopyId: string | null;
  refresh: () => Promise<void>;
  addSkill: (input: AddSkillInput) => Promise<boolean>;
  updateSkill: (input: UpdateSkillInput) => Promise<boolean>;
  copySkill: (input: CopySkillInput) => Promise<boolean>;
  discoverGithubSkills: (githubRepoUrl: string) => Promise<GithubSkillDiscoveryResult | null>;
  removeSkill: (input: RemoveSkillInput) => Promise<boolean>;
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

function prefixWarning(client: ClientKind, warning: string): string {
  const trimmed = warning.trim();
  if (trimmed.length === 0) {
    return "";
  }

  return `${formatClientLabel(client)}: ${trimmed}`;
}

export function useSkillManager(): UseSkillManagerResult {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<ErrorDiagnostic | null>(null);
  const [feedback, setFeedback] = useState<MutationFeedback | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const [pendingCopyId, setPendingCopyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPhase("loading");
    setOperationError(null);

    try {
      const results = await Promise.all(
        SKILL_CLIENTS.map(async (client) => {
          try {
            const envelope = await listResources({
              client,
              resource_kind: "skill",
            });

            return { client, envelope, runtimeError: null as ErrorDiagnostic | null };
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown list runtime error.";
            return {
              client,
              envelope: null,
              runtimeError: runtimeErrorToDiagnostic(message),
            };
          }
        }),
      );

      const aggregatedResources: ResourceRecord[] = [];
      const warnings: string[] = [];
      const diagnostics: ErrorDiagnostic[] = [];

      for (const result of results) {
        if (result.runtimeError) {
          diagnostics.push(result.runtimeError);
          warnings.push(prefixWarning(result.client, result.runtimeError.message));
          continue;
        }

        const envelope = result.envelope;
        if (!envelope || !envelope.ok || envelope.data === null) {
          const diagnostic = envelope
            ? envelopeErrorDiagnostic(
                envelope,
                "List command failed without an explicit error payload.",
              )
            : runtimeErrorToDiagnostic("List command failed without an explicit error payload.");
          diagnostics.push(diagnostic);
          warnings.push(prefixWarning(result.client, diagnostic.message));
          continue;
        }

        aggregatedResources.push(...envelope.data.items);
        if (envelope.data.warning) {
          const redactedWarning = redactNullableSensitiveText(envelope.data.warning);
          warnings.push(prefixWarning(result.client, redactedWarning ?? envelope.data.warning));
        }
      }

      if (aggregatedResources.length === 0 && diagnostics.length > 0) {
        setPhase("error");
        setResources([]);
        setWarning(null);
        setOperationError(diagnostics[0]);
        return;
      }

      setResources(sortSkillResources(aggregatedResources));
      setWarning(warnings.filter((entry) => entry.length > 0).join(" | ") || null);
      setOperationError(null);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setResources([]);
      setWarning(null);
      const message = error instanceof Error ? error.message : "Unknown list runtime error.";
      setOperationError(runtimeErrorToDiagnostic(message));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addSkill = useCallback(
    async (input: AddSkillInput) => {
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
          client: input.destinationClient,
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
    [refresh],
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
    async (input: RemoveSkillInput) => {
      setPendingRemovalId(input.resourceId);
      try {
        const envelope = await mutateResource({
          client: input.client,
          resource_kind: "skill",
          action: "remove",
          target_id: input.targetId,
          payload: input.sourcePath ? { source_path: input.sourcePath } : null,
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
    [refresh],
  );

  const updateSkill = useCallback(
    async (input: UpdateSkillInput) => {
      setPendingUpdateId(input.resourceId);
      try {
        const payload: Record<string, unknown> =
          input.mode === "github"
            ? {
                github_repo_url: input.githubRepoUrl.trim(),
                github_skill_path: input.githubSkillPath,
                install_kind: input.installKind,
              }
            : {
                manifest: input.manifest,
                install_kind: input.installKind,
              };

        const envelope = await mutateResource({
          client: input.client,
          resource_kind: "skill",
          action: "update",
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
        const message = error instanceof Error ? error.message : "Unknown update runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      } finally {
        setPendingUpdateId(null);
      }
    },
    [refresh],
  );

  const copySkill = useCallback(
    async (input: CopySkillInput) => {
      if (input.destinationClient === input.sourceClient) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Choose a different destination client when copying a skill entry.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      const normalizedTargetId = input.targetId.trim();
      if (normalizedTargetId.length === 0) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Target ID is required before copying a skill entry.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      if (input.manifest.trim().length === 0) {
        const diagnostic = runtimeErrorToDiagnostic(
          "Manifest content is required before copying a skill entry.",
        );
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      }

      setPendingCopyId(input.sourceResourceId);
      try {
        const envelope = await mutateResource({
          client: input.destinationClient,
          resource_kind: "skill",
          action: "add",
          target_id: normalizedTargetId,
          payload: {
            manifest: input.manifest,
            install_kind: input.installKind,
          },
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
        const message = error instanceof Error ? error.message : "Unknown copy runtime error.";
        const diagnostic = runtimeErrorToDiagnostic(message);
        setFeedback({
          kind: "error",
          message: diagnostic.message,
          diagnostic,
        });
        return false;
      } finally {
        setPendingCopyId(null);
      }
    },
    [refresh],
  );

  return {
    phase,
    resources,
    warning,
    operationError,
    feedback,
    pendingRemovalId,
    pendingUpdateId,
    pendingCopyId,
    refresh,
    addSkill,
    updateSkill,
    copySkill,
    discoverGithubSkills,
    removeSkill,
    clearFeedback: () => setFeedback(null),
  };
}
