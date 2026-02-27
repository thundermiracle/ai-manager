import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKSPACE_ROOT = new URL("..", import.meta.url);

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, WORKSPACE_ROOT), "utf8");
}

test("package dependencies include tailwind v4 and shadcn/ui primitives", async () => {
  const packageSource = await readWorkspaceFile("./package.json");
  const packageJson = JSON.parse(packageSource);

  assert.equal(typeof packageJson.devDependencies.tailwindcss, "string");
  assert.equal(typeof packageJson.devDependencies["@tailwindcss/vite"], "string");
  assert.equal(typeof packageJson.dependencies["class-variance-authority"], "string");
  assert.equal(typeof packageJson.dependencies.clsx, "string");
  assert.equal(typeof packageJson.dependencies["tailwind-merge"], "string");
  assert.equal(typeof packageJson.dependencies["@radix-ui/react-slot"], "string");
});

test("vite config enables the tailwind v4 vite plugin", async () => {
  const viteSource = await readWorkspaceFile("./vite.config.ts");

  assert.match(viteSource, /import\s+tailwindcss\s+from\s+"@tailwindcss\/vite"/);
  assert.match(viteSource, /plugins:\s*\[\s*tailwindcss\(\),\s*react\(\)\s*\]/);
});

test("stylesheet is tailwind entrypoint and no longer holds app-shell component classes", async () => {
  const appCss = await readWorkspaceFile("./src/App.css");

  assert.match(appCss, /@import\s+"tailwindcss";/);
  assert.doesNotMatch(appCss, /\.app-shell\s*\{/);
});

test("shadcn metadata and ui component files are present", async () => {
  const componentsJson = await readWorkspaceFile("./components.json");
  const buttonSource = await readWorkspaceFile("./src/components/ui/button.tsx");
  const utilsSource = await readWorkspaceFile("./src/lib/utils.ts");

  assert.match(componentsJson, /"style":\s*"new-york"/);
  assert.match(buttonSource, /class-variance-authority/);
  assert.match(buttonSource, /@radix-ui\/react-slot/);
  assert.match(utilsSource, /twMerge/);
});
