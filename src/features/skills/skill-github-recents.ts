import type { ClientKind } from "../../backend/contracts";

const STORAGE_PREFIX = "ai-manager.skills.github.recent";
const MAX_RECENT_GITHUB_REPO_URLS = 8;

function normalizeGithubRepoUrl(value: string): string {
  return value.trim().replace(/\/+$/g, "");
}

function dedupeAndLimit(urls: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const rawUrl of urls) {
    const normalized = normalizeGithubRepoUrl(rawUrl);
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ordered.push(normalized);
    if (ordered.length >= MAX_RECENT_GITHUB_REPO_URLS) {
      break;
    }
  }

  return ordered;
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function buildSkillGithubRecentsStorageKey(client: ClientKind): string {
  return `${STORAGE_PREFIX}.${client}`;
}

export function loadSkillGithubRecents(storageKey: string): string[] {
  const storage = getLocalStorage();
  if (storage === null) {
    return [];
  }

  try {
    const raw = storage.getItem(storageKey);
    if (raw === null) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return dedupeAndLimit(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return [];
  }
}

export function rememberSkillGithubRepoUrl(storageKey: string, githubRepoUrl: string): string[] {
  const normalizedUrl = normalizeGithubRepoUrl(githubRepoUrl);
  if (normalizedUrl.length === 0) {
    return loadSkillGithubRecents(storageKey);
  }

  const next = dedupeAndLimit([normalizedUrl, ...loadSkillGithubRecents(storageKey)]);
  const storage = getLocalStorage();

  if (storage !== null) {
    try {
      storage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore storage write failures so add/update flow remains functional.
    }
  }

  return next;
}
