import type { ResourceRecord } from "../../backend/contracts";

function normalizeManifest(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function fnv1a32(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildSkillManifestChecksum(manifest: string): string {
  return fnv1a32(normalizeManifest(manifest));
}

export function buildResourceSkillManifestChecksum(resource: ResourceRecord): string | null {
  if (resource.manifest_content === null || resource.manifest_content.trim().length === 0) {
    return null;
  }
  return buildSkillManifestChecksum(resource.manifest_content);
}
