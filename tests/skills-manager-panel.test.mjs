import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("app renders the skills manager route component", async () => {
  const shellSource = await readWorkspaceFile("./src/App.tsx");

  assert.match(shellSource, /SkillsManagerPanel/);
  assert.match(shellSource, /route === "mcp"/);
});

test("skills manager hook calls list and mutate commands", async () => {
  const hookSource = await readWorkspaceFile("./src/features/skills/useSkillManager.ts");

  assert.match(hookSource, /listResources/);
  assert.match(hookSource, /discoverSkillRepository/);
  assert.match(hookSource, /mutateResource/);
  assert.match(hookSource, /resource_kind: "skill"/);
  assert.match(hookSource, /action: "add"/);
  assert.match(hookSource, /action: "remove"/);
  assert.match(hookSource, /action: "update"/);
  assert.match(hookSource, /github_repo_url/);
  assert.match(hookSource, /github_skill_path/);
  assert.match(hookSource, /input\.mode === "github"/);
  assert.match(hookSource, /manifest: input\.manifest/);
});

test("skills add form separates manual and GitHub modes", async () => {
  const formSource = await readWorkspaceFile("./src/features/skills/SkillAddForm.tsx");
  const stateSource = await readWorkspaceFile("./src/features/skills/useSkillAddForm.ts");

  assert.match(formSource, /Add Method/);
  assert.match(formSource, /Manual/);
  assert.match(formSource, /GitHub URL/);
  assert.match(formSource, /GitHub Repository URL/);
  assert.match(formSource, /Discovered Skills/);
  assert.match(formSource, /I understand remote repository content can be unsafe/);
  assert.match(formSource, /id="skill-github-url"/);
  assert.match(formSource, /onGithubRepoUrlChange/);
  assert.match(formSource, /onDiscoverGithubRepo/);
  assert.match(formSource, /onSelectedGithubManifestPathChange/);
  assert.match(formSource, /onGithubRiskAcknowledgedChange/);
  assert.match(formSource, /state.mode === "github" && !state.githubRiskAcknowledged/);
  assert.match(formSource, /disabled=\{submitDisabled\}/);
  assert.match(stateSource, /export type SkillAddMode = "manual" \| "github"/);
  assert.match(stateSource, /githubRepoUrl/);
  assert.match(stateSource, /discoverGithubRepo/);
  assert.match(stateSource, /selectedGithubManifestPath/);
  assert.match(stateSource, /githubRiskAcknowledged/);
});

test("skills manager remove action uses in-app confirmation modal", async () => {
  const panelSource = await readWorkspaceFile("./src/features/skills/SkillsManagerPanel.tsx");

  assert.match(panelSource, /ConfirmModal/);
  assert.match(panelSource, /Remove Skill Entry/);
  assert.match(panelSource, /Edit Skill Entry/);
  assert.match(panelSource, /SkillEditForm/);
  assert.doesNotMatch(panelSource, /window\.confirm/);
});

test("skills manager uses snackbar for transient feedback", async () => {
  const panelSource = await readWorkspaceFile("./src/features/skills/SkillsManagerPanel.tsx");

  assert.match(panelSource, /Snackbar/);
  assert.match(panelSource, /durationMs=\{5000\}/);
  assert.doesNotMatch(panelSource, /feedback\?\.kind === "success"[\s\S]*<Alert/s);
});
