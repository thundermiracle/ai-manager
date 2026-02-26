import { useCallback, useEffect, useState } from "react";

import { listResources, mutateResource } from "../../backend/client";
import type { ClientKind, CommandEnvelope, ResourceRecord } from "../../backend/contracts";

export type SkillInstallInputKind = "directory" | "file";

export interface AddSkillInput {
  targetId: string;
  manifest: string;
  installKind: SkillInstallInputKind;
}

interface MutationFeedback {
  kind: "success" | "error";
  message: string;
}

type LoadPhase = "idle" | "loading" | "ready" | "error";

interface UseSkillManagerResult {
  phase: LoadPhase;
  resources: ResourceRecord[];
  warning: string | null;
  operationError: string | null;
  feedback: MutationFeedback | null;
  pendingRemovalId: string | null;
  refresh: () => Promise<void>;
  addSkill: (input: AddSkillInput) => Promise<boolean>;
  removeSkill: (targetId: string, sourcePath: string | null) => Promise<boolean>;
  clearFeedback: () => void;
}

function envelopeErrorMessage(envelope: CommandEnvelope<unknown>): string {
  if (envelope.error?.message) {
    return envelope.error.message;
  }
  return "Command failed without an explicit error payload.";
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
  const [operationError, setOperationError] = useState<string | null>(null);
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
        setOperationError(envelopeErrorMessage(envelope));
        return;
      }

      setResources(sortResources(envelope.data.items));
      setWarning(envelope.data.warning);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setOperationError(error instanceof Error ? error.message : "Unknown list runtime error.");
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addSkill = useCallback(
    async (input: AddSkillInput) => {
      if (client === null) {
        setFeedback({
          kind: "error",
          message: "Select a client before adding a skill entry.",
        });
        return false;
      }

      try {
        const envelope = await mutateResource({
          client,
          resource_kind: "skill",
          action: "add",
          target_id: input.targetId,
          payload: {
            manifest: input.manifest,
            install_kind: input.installKind,
          },
        });

        if (!envelope.ok || envelope.data === null) {
          setFeedback({ kind: "error", message: envelopeErrorMessage(envelope) });
          return false;
        }

        setFeedback({ kind: "success", message: envelope.data.message });
        await refresh();
        return true;
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Unknown add runtime error.",
        });
        return false;
      }
    },
    [client, refresh],
  );

  const removeSkill = useCallback(
    async (targetId: string, sourcePath: string | null) => {
      if (client === null) {
        setFeedback({
          kind: "error",
          message: "Select a client before removing a skill entry.",
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
          setFeedback({ kind: "error", message: envelopeErrorMessage(envelope) });
          return false;
        }

        setFeedback({ kind: "success", message: envelope.data.message });
        await refresh();
        return true;
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Unknown remove runtime error.",
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
    removeSkill,
    clearFeedback: () => setFeedback(null),
  };
}
