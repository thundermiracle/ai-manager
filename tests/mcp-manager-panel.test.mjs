import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("app renders the MCP manager route component", async () => {
  const shellSource = await readWorkspaceFile("./src/App.tsx");

  assert.match(shellSource, /McpManagerPanel/);
  assert.match(shellSource, /route === "mcp"/);
});

test("mcp manager hook calls list and mutate commands", async () => {
  const hookSource = await readWorkspaceFile("./src/features/mcp/useMcpManager.ts");

  assert.match(hookSource, /listResources/);
  assert.match(hookSource, /mutateResource/);
  assert.match(hookSource, /action: "add"/);
  assert.match(hookSource, /action: "remove"/);
  assert.match(hookSource, /action: "update"/);
});

test("mcp add form separates registry, presets, and manual modes", async () => {
  const panelSource = await readWorkspaceFile("./src/features/mcp/McpManagerPanel.tsx");
  const formSource = await readWorkspaceFile("./src/features/mcp/McpAddForm.tsx");
  const addFormHookSource = await readWorkspaceFile("./src/features/mcp/useMcpAddForm.ts");
  const registrySource = await readWorkspaceFile("./src/features/mcp/mcp-registry.ts");
  const presetsSource = await readWorkspaceFile("./src/features/mcp/official-presets.ts");

  assert.match(panelSource, /openUrl/);
  assert.match(panelSource, /onModeChange/);
  assert.match(panelSource, /onRegistryQueryChange/);
  assert.match(panelSource, /onReloadRegistry/);

  assert.match(formSource, /Add Method/);
  assert.match(formSource, /Official Registry/);
  assert.match(formSource, /Presets/);
  assert.match(formSource, /Manual/);
  assert.match(formSource, /Registry Search/);
  assert.match(formSource, /Official MCP Registry/);
  assert.match(formSource, /Curated Presets/);
  assert.match(formSource, /Use Entry/);
  assert.match(formSource, /Use Preset/);
  assert.match(formSource, /Loaded to Form/);
  assert.match(formSource, /You can edit the fields below before adding/);
  assert.match(formSource, /Loaded to Form/);
  assert.match(formSource, /sticky top-0 z-10/);
  assert.match(formSource, /scrollIntoView/);
  assert.match(formSource, /behavior: "smooth"/);
  assert.match(formSource, /state\.mode === "registry"/);
  assert.match(formSource, /state\.mode === "preset"/);
  assert.match(formSource, /state\.mode === "manual"/);
  assert.match(formSource, /state\.registryLoading/);
  assert.match(formSource, /state\.registryError/);
  assert.match(formSource, /event\.key !== "Enter"/);
  assert.match(formSource, /onKeyDown=\{handleRegistryInputKeyDown\}/);

  assert.match(addFormHookSource, /export type McpAddMode = "registry" \| "preset" \| "manual"/);
  assert.match(addFormHookSource, /setMode/);
  assert.match(addFormHookSource, /applyPreset/);
  assert.match(addFormHookSource, /reloadRegistry/);
  assert.match(addFormHookSource, /searchRegistryPresets/);
  assert.match(addFormHookSource, /setRegistryQuery/);
  assert.match(addFormHookSource, /selectedRegistryPresetId/);
  assert.match(addFormHookSource, /selectedPresetId/);
  assert.match(addFormHookSource, /registryResults/);
  assert.match(addFormHookSource, /preset\.transport\.mode === "stdio"/);

  assert.match(registrySource, /registry\.modelcontextprotocol\.io\/v0\.1\/servers/);
  assert.match(registrySource, /searchRegistryPresets/);

  assert.match(presetsSource, /MCP_FALLBACK_PRESETS/);
  assert.match(presetsSource, /name: "GitHub"/);
  assert.match(presetsSource, /name: "Chrome DevTools"/);
  assert.match(presetsSource, /name: "Figma"/);
  assert.match(presetsSource, /name: "Playwright"/);
});

test("mcp manager remove action uses in-app confirmation modal", async () => {
  const panelSource = await readWorkspaceFile("./src/features/mcp/McpManagerPanel.tsx");

  assert.match(panelSource, /ConfirmModal/);
  assert.match(panelSource, /Remove MCP Entry/);
  assert.match(panelSource, /Edit MCP Entry/);
  assert.match(panelSource, /McpEditForm/);
  assert.doesNotMatch(panelSource, /window\.confirm/);
});

test("mcp manager uses snackbar for transient feedback", async () => {
  const panelSource = await readWorkspaceFile("./src/features/mcp/McpManagerPanel.tsx");

  assert.match(panelSource, /Snackbar/);
  assert.match(panelSource, /durationMs=\{5000\}/);
  assert.doesNotMatch(panelSource, /feedback\?\.kind === "success"[\s\S]*<Alert/s);
});
