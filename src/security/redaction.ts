const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  "(?:access[_-]?token|api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)";
const KEY_VALUE_REGEX = new RegExp(
  `((?:['"]?${SENSITIVE_KEY_PATTERN}['"]?)\\s*[:=]\\s*)((?:bearer\\s+[A-Za-z0-9._~+/=-]+)|(?:"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^\\s,;}\\])]+))`,
  "gi",
);
const BEARER_REGEX = /(\bbearer\s+)[A-Za-z0-9._~+/=-]+/gi;
const KNOWN_TOKEN_REGEX =
  /\b(?:sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|AIza[0-9A-Za-z_-]{20,})\b/gi;

function redactValue(value: string): string {
  if (value.toLowerCase().startsWith("bearer ")) {
    return `Bearer ${REDACTED_VALUE}`;
  }

  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return `${first}${REDACTED_VALUE}${last}`;
    }
  }

  return REDACTED_VALUE;
}

export function redactSensitiveText(input: string): string {
  if (input.length === 0) {
    return "";
  }

  const redactedAssignments = input.replace(
    KEY_VALUE_REGEX,
    (_matched: string, prefix: string, value: string) => {
      return `${prefix}${redactValue(value)}`;
    },
  );

  const redactedBearer = redactedAssignments.replace(
    BEARER_REGEX,
    (_matched: string, prefix: string) => `${prefix}${REDACTED_VALUE}`,
  );

  return redactedBearer.replace(KNOWN_TOKEN_REGEX, REDACTED_VALUE);
}

export function redactNullableSensitiveText(input: string | null | undefined): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  return redactSensitiveText(input);
}

export function toRedactedRuntimeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return redactSensitiveText(error.message);
  }

  return redactSensitiveText(fallback);
}
