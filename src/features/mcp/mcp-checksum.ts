import type { ResourceRecord } from "../../backend/contracts";
import type { McpOfficialPreset } from "./official-presets";
import type { McpTransportInput } from "./useMcpManager";

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeArgs(args: readonly string[]): string[] {
  return args.map((arg) => arg.trim()).filter((arg) => arg.length > 0);
}

function buildCanonicalTransportSignature(
  transport:
    | { kind: "stdio"; command: string; args: readonly string[] }
    | { kind: "sse"; url: string },
): string {
  if (transport.kind === "stdio") {
    return JSON.stringify({
      kind: "stdio",
      command: normalizeText(transport.command),
      args: normalizeArgs(transport.args),
    });
  }

  return JSON.stringify({
    kind: "sse",
    url: normalizeText(transport.url),
  });
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildTransportChecksum(transport: McpTransportInput): string {
  if (transport.kind === "stdio") {
    return fnv1a32(
      buildCanonicalTransportSignature({
        kind: "stdio",
        command: transport.command,
        args: transport.args,
      }),
    );
  }

  return fnv1a32(
    buildCanonicalTransportSignature({
      kind: "sse",
      url: transport.url,
    }),
  );
}

export function buildResourceTransportChecksum(resource: ResourceRecord): string | null {
  if (resource.transport_kind === "stdio") {
    if (!resource.transport_command) {
      return null;
    }
    return fnv1a32(
      buildCanonicalTransportSignature({
        kind: "stdio",
        command: resource.transport_command,
        args: resource.transport_args ?? [],
      }),
    );
  }

  if (resource.transport_kind === "sse") {
    if (!resource.transport_url) {
      return null;
    }
    return fnv1a32(
      buildCanonicalTransportSignature({
        kind: "sse",
        url: resource.transport_url,
      }),
    );
  }

  return null;
}

export function buildPresetTransportChecksum(preset: McpOfficialPreset): string {
  if (preset.transport.mode === "stdio") {
    return fnv1a32(
      buildCanonicalTransportSignature({
        kind: "stdio",
        command: preset.transport.command,
        args: preset.transport.args,
      }),
    );
  }

  return fnv1a32(
    buildCanonicalTransportSignature({
      kind: "sse",
      url: preset.transport.url,
    }),
  );
}
