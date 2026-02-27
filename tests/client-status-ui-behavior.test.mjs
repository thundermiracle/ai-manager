import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("app shell and navigation do not expose issue number labels in UI text", async () => {
  const shellSource = await readWorkspaceFile("./src/features/app-shell/AppShell.tsx");
  const navigationSource = await readWorkspaceFile("./src/features/app-shell/navigation.ts");

  assert.doesNotMatch(shellSource, /Issue\s*#\d+/);
  assert.doesNotMatch(navigationSource, /Issue\s*#\d+/);
});

test("desktop sidebar uses fixed positioning and mobile layout reverts to static", async () => {
  const cssSource = await readWorkspaceFile("./src/App.css");

  assert.match(cssSource, /\.app-sidebar\s*\{[^}]*position:\s*fixed;/s);
  assert.match(cssSource, /\.app-sidebar\s*\{[^}]*height:\s*calc\(100vh - 2rem\);/s);
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.app-sidebar\s*\{[\s\S]*position:\s*static;/,
  );
});

test("client status cards render details blocks collapsed by default", async () => {
  const cardSource = await readWorkspaceFile(
    "./src/features/clients/components/ClientStatusCard.tsx",
  );

  assert.match(cardSource, /<details className="client-details">/);
  assert.match(cardSource, /<summary>Show tool details<\/summary>/);
  assert.doesNotMatch(cardSource, /<details[^>]*\bopen\b/);
});
