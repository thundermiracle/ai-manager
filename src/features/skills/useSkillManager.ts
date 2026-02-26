import { useCallback, useEffect, useState } from "react";

import { listResources, mutateResource } from "../../backend/client";
import type { ClientKind, CommandEnvelope, ResourceRecord } from "../../backend/contracts";
import { redactNullableSensitiveText, redactSensitiveText } from "../../security/redaction";
import {
  commandErrorToDiagnostic,
  type ErrorDiagnostic,
  runtimeErrorToDiagnostic,
} from "../common/errorDiagnostics";

export type SkillInstallInputKind = "directory" | "file";

export interface AddSkillInput {
  targetId: string;
  manifest: string;
  installKind: SkillInstallInputKind;
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
    removeSkill,
    clearFeedback: () => setFeedback(null),
  };
}
