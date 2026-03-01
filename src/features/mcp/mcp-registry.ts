import type { McpOfficialPreset } from "./official-presets";

const MCP_REGISTRY_SERVERS_ENDPOINT = "https://registry.modelcontextprotocol.io/v0.1/servers";
const OFFICIAL_META_KEY = "io.modelcontextprotocol.registry/official";

interface RegistryResponse {
  servers: RegistryServerEnvelope[];
}

interface RegistryServerEnvelope {
  server: RegistryServer;
  _meta?: Record<string, RegistryOfficialMeta | undefined>;
}

interface RegistryOfficialMeta {
  isLatest?: boolean;
}

interface RegistryServer {
  name?: string;
  title?: string;
  description?: string;
  version?: string;
  websiteUrl?: string;
  repository?: {
    url?: string;
  };
  remotes?: RegistryRemote[];
  packages?: RegistryPackage[];
}

interface RegistryRemote {
  type?: string;
  url?: string;
}

interface RegistryPackageArgument {
  type?: string;
  value?: string;
}

interface RegistryPackage {
  registryType?: string;
  identifier?: string;
  transport?: {
    type?: string;
  };
  packageArguments?: RegistryPackageArgument[];
}

export async function searchRegistryPresets(
  search: string,
  limit = 30,
): Promise<McpOfficialPreset[]> {
  const query = search.trim();
  if (query.length === 0) {
    return [];
  }

  const url = new URL(MCP_REGISTRY_SERVERS_ENDPOINT);
  url.searchParams.set("search", query);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Registry request failed with status ${response.status}.`);
  }

  const body = (await response.json()) as RegistryResponse;
  const latestByServerName = new Map<string, RegistryServerEnvelope>();

  for (const envelope of body.servers ?? []) {
    const serverName = envelope.server.name?.trim() ?? "";
    if (serverName.length === 0) {
      continue;
    }

    const current = latestByServerName.get(serverName);
    if (current === undefined) {
      latestByServerName.set(serverName, envelope);
      continue;
    }

    if (isLatestRecord(envelope) && !isLatestRecord(current)) {
      latestByServerName.set(serverName, envelope);
    }
  }

  const presets: McpOfficialPreset[] = [];
  for (const envelope of latestByServerName.values()) {
    const preset = toPreset(envelope.server);
    if (preset !== null) {
      presets.push(preset);
    }
  }

  presets.sort((left, right) => left.name.localeCompare(right.name));
  return presets;
}

function isLatestRecord(record: RegistryServerEnvelope): boolean {
  return record._meta?.[OFFICIAL_META_KEY]?.isLatest === true;
}

function toPreset(server: RegistryServer): McpOfficialPreset | null {
  const rawName = server.name?.trim() || server.title?.trim();
  if (!rawName) {
    return null;
  }

  const transport = resolveTransport(server);
  if (transport === null) {
    return null;
  }

  const version = server.version?.trim();
  const summary = (server.description?.trim() || "No description provided by registry.").slice(
    0,
    220,
  );
  const docsUrl =
    server.repository?.url?.trim() || server.websiteUrl?.trim() || resolveRemoteUrl(server) || "";
  if (docsUrl.length === 0) {
    return null;
  }

  return {
    id: version ? `${rawName}@${version}` : rawName,
    name: server.title?.trim() || rawName,
    summary,
    sourceLabel: "MCP Registry",
    docsUrl,
    targetId: suggestTargetId(rawName),
    transport,
    notes: buildNotes(transport, version),
  };
}

function resolveTransport(server: RegistryServer): McpOfficialPreset["transport"] | null {
  const remoteUrl = resolveRemoteUrl(server);
  if (remoteUrl) {
    return { mode: "sse", url: remoteUrl };
  }

  const packages = server.packages ?? [];
  const npmStdioPackage = packages.find(
    (pkg) => pkg.registryType === "npm" && pkg.transport?.type === "stdio" && pkg.identifier,
  );
  if (npmStdioPackage?.identifier) {
    const args = ["-y", npmStdioPackage.identifier, ...resolvePackageArgs(npmStdioPackage)];
    return { mode: "stdio", command: "npx", args };
  }

  const pypiStdioPackage = packages.find(
    (pkg) => pkg.registryType === "pypi" && pkg.transport?.type === "stdio" && pkg.identifier,
  );
  if (pypiStdioPackage?.identifier) {
    const args = [pypiStdioPackage.identifier, ...resolvePackageArgs(pypiStdioPackage)];
    return { mode: "stdio", command: "uvx", args };
  }

  return null;
}

function resolveRemoteUrl(server: RegistryServer): string | null {
  for (const remote of server.remotes ?? []) {
    if (
      (remote.type === "sse" || remote.type === "streamable-http") &&
      typeof remote.url === "string" &&
      remote.url.trim().length > 0
    ) {
      return remote.url.trim();
    }
  }
  return null;
}

function resolvePackageArgs(pkg: RegistryPackage): string[] {
  const args: string[] = [];
  for (const arg of pkg.packageArguments ?? []) {
    if (arg.type === "positional" && typeof arg.value === "string" && arg.value.trim().length > 0) {
      args.push(arg.value.trim());
    }
  }
  return args;
}

function suggestTargetId(rawName: string): string {
  const fromName = rawName.includes("/") ? (rawName.split("/").pop() ?? rawName) : rawName;
  return sanitizeTargetId(fromName);
}

function sanitizeTargetId(value: string): string {
  const normalized = value.toLowerCase();
  let output = "";
  let previousDash = false;

  for (const character of normalized) {
    if ((character >= "a" && character <= "z") || (character >= "0" && character <= "9")) {
      output += character;
      previousDash = false;
      continue;
    }
    if (!previousDash) {
      output += "-";
      previousDash = true;
    }
  }

  const trimmed = output.replace(/^-+|-+$/g, "");
  return trimmed.length > 0 ? trimmed : "mcp-server";
}

function buildNotes(
  transport: McpOfficialPreset["transport"],
  version: string | undefined,
): string[] {
  const notes: string[] = [];
  if (version && version.length > 0) {
    notes.push(`Version: ${version}`);
  }
  if (transport.mode === "stdio") {
    notes.push("Review required environment variables in docs before enabling.");
  } else {
    notes.push("Remote endpoint may require provider-side authentication.");
  }
  return notes;
}
