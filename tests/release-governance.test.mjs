import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseMarkdownSections(markdown) {
  const lines = markdown.split("\n");
  const sections = new Map();
  let currentHeading = null;
  let currentLines = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentHeading !== null) {
        sections.set(currentHeading, currentLines.join("\n"));
      }
      currentHeading = normalize(headingMatch[1]);
      currentLines = [];
      continue;
    }

    if (currentHeading !== null) {
      currentLines.push(line);
    }
  }

  if (currentHeading !== null) {
    sections.set(currentHeading, currentLines.join("\n"));
  }

  return sections;
}

function assertContainsTokens(text, tokens, label) {
  const normalized = normalize(text);
  for (const token of tokens) {
    assert.ok(
      normalized.includes(normalize(token)),
      `${label} is missing required token: ${token}`,
    );
  }
}

test("release checklist defines blocking gates and evidence", async () => {
  const checklist = await readWorkspaceFile("./docs/release/release-checklist.md");
  const sections = parseMarkdownSections(checklist);

  assert.ok(sections.has("release readiness rule"));
  assert.ok(sections.has("blocking checklist"));

  assertContainsTokens(
    sections.get("release readiness rule"),
    ["decision", "go", "blocking", "evidence"],
    "release readiness rule",
  );
  assertContainsTokens(
    sections.get("blocking checklist"),
    ["pnpm run ci", "macos dmg", "dmg-manifest.json", "release-notes-template.md"],
    "blocking checklist",
  );
});

test("versioning policy defines deterministic major/minor/patch rules", async () => {
  const policy = await readWorkspaceFile("./docs/release/versioning-policy.md");
  const sections = parseMarkdownSections(policy);

  assertContainsTokens(policy, ["semantic versioning"], "versioning policy");
  assert.ok(sections.has("deterministic increment rules"));
  assert.ok(sections.has("change classification checklist"));

  assertContainsTokens(
    sections.get("deterministic increment rules"),
    ["major", "minor", "patch"],
    "deterministic increment rules",
  );
});

test("release notes template includes communication sections", async () => {
  const template = await readWorkspaceFile("./docs/release/release-notes-template.md");
  const sections = parseMarkdownSections(template);
  const sectionNames = new Set(sections.keys());

  assert.ok(sectionNames.has("summary"));
  assert.ok(sectionNames.has("compatibility"));
  assert.ok(sectionNames.has("upgrade and migration notes"));
  assert.ok(sectionNames.has("known issues"));
  assert.ok(sectionNames.has("artifacts"));

  assertContainsTokens(
    sections.get("artifacts"),
    ["dist/macos/dmg-manifest.json"],
    "release notes artifacts section",
  );
});

test("readme indexes release documentation directory", async () => {
  const readme = await readWorkspaceFile("./README.md");
  const releaseDocsLine = readme
    .split("\n")
    .find((line) => line.toLowerCase().includes("`docs/release/`"));

  assert.ok(releaseDocsLine, "README must include docs/release index line");
  assertContainsTokens(
    releaseDocsLine,
    ["packaging", "release checklist", "versioning policy"],
    "README docs/release index line",
  );
});
