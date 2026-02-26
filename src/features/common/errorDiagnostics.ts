import type { CommandError, CommandErrorCode } from "../../backend/contracts";
import { redactSensitiveText } from "../../security/redaction";

const BACKUP_PATH_PATTERN = /Backup:\s*([^\n.]+)\.?/i;
const SOURCE_PATH_PATTERN = /Source:\s*([^\n.]+)\.?/i;

export type UiErrorCode = CommandErrorCode | "RUNTIME_ERROR";

export interface ErrorDiagnostic {
  code: UiErrorCode;
  recoverable: boolean;
  message: string;
  backupPath: string | null;
  sourcePath: string | null;
  guidance: string[];
}

export function commandErrorToDiagnostic(error: CommandError): ErrorDiagnostic {
  return buildDiagnostic(error.code, error.recoverable, error.message);
}

export function runtimeErrorToDiagnostic(message: string): ErrorDiagnostic {
  return buildDiagnostic("RUNTIME_ERROR", true, message);
}

function buildDiagnostic(
  code: UiErrorCode,
  recoverable: boolean,
  rawMessage: string,
): ErrorDiagnostic {
  const message = redactSensitiveText(rawMessage);
  const backupPath = extractPath(message, BACKUP_PATH_PATTERN);
  const sourcePath = extractPath(message, SOURCE_PATH_PATTERN);

  return {
    code,
    recoverable,
    message,
    backupPath,
    sourcePath,
    guidance: buildGuidance(code, recoverable, backupPath, sourcePath),
  };
}

function extractPath(message: string, pattern: RegExp): string | null {
  const match = message.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function buildGuidance(
  code: UiErrorCode,
  recoverable: boolean,
  backupPath: string | null,
  sourcePath: string | null,
): string[] {
  const guidance: string[] = [];

  switch (code) {
    case "VALIDATION_ERROR":
      guidance.push("Check required fields and retry the same action.");
      break;
    case "NOT_IMPLEMENTED":
      guidance.push("This action is not supported for the selected client yet.");
      break;
    case "SHUTTING_DOWN":
      guidance.push("Restart the application, then retry the operation.");
      break;
    case "INTERNAL_ERROR":
      guidance.push("Inspect the config and backups before retrying repeatedly.");
      break;
    case "RUNTIME_ERROR":
      guidance.push("Retry after confirming the selected file paths are accessible.");
      break;
    default:
      guidance.push("Retry the operation after checking the current client configuration.");
      break;
  }

  if (!recoverable) {
    guidance.push("Marked non-recoverable: manual intervention is likely required.");
  }

  if (backupPath) {
    if (sourcePath) {
      guidance.push(`Restore if needed: cp "${backupPath}" "${sourcePath}"`);
    } else {
      guidance.push(`Backup available for manual restore: ${backupPath}`);
    }
  }

  return guidance;
}
