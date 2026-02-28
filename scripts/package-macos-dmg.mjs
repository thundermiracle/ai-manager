import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tauriConfigPath = path.join(workspaceRoot, "src-tauri", "tauri.conf.json");
const dmgOutputDir = path.join(workspaceRoot, "src-tauri", "target", "release", "bundle", "dmg");
const manifestOutputPath = path.join(workspaceRoot, "dist", "macos", "dmg-manifest.json");

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("macOS packaging is only supported on darwin hosts.");
  }

  await runCommand("pnpm", ["exec", "tauri", "build", "--bundles", "dmg"]);

  const dmgArtifact = await findLatestDmgArtifact(dmgOutputDir);
  const artifactStats = await stat(dmgArtifact.absolutePath);
  const sha256 = await sha256File(dmgArtifact.absolutePath);
  const tauriConfig = await loadTauriConfig(tauriConfigPath);

  const manifest = {
    generated_at_iso: new Date().toISOString(),
    product_name: tauriConfig.productName,
    identifier: tauriConfig.identifier,
    artifact: {
      file_name: dmgArtifact.fileName,
      relative_path: path.relative(workspaceRoot, dmgArtifact.absolutePath),
      bytes: artifactStats.size,
      sha256,
    },
  };

  await mkdir(path.dirname(manifestOutputPath), { recursive: true });
  await writeFile(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`DMG packaged: ${manifest.artifact.relative_path}`);
  console.log(`Manifest written: ${path.relative(workspaceRoot, manifestOutputPath)}`);
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}`));
    });
  });
}

async function findLatestDmgArtifact(outputDir) {
  const entries = await readdir(outputDir, { withFileTypes: true });
  const dmgFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".dmg"));
  if (dmgFiles.length === 0) {
    throw new Error(`No DMG artifact found under '${outputDir}'.`);
  }

  const withStats = await Promise.all(
    dmgFiles.map(async (entry) => {
      const absolutePath = path.join(outputDir, entry.name);
      const details = await stat(absolutePath);
      return {
        fileName: entry.name,
        absolutePath,
        modifiedMs: details.mtimeMs,
      };
    }),
  );

  withStats.sort((left, right) => right.modifiedMs - left.modifiedMs);
  return withStats[0];
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  return hash.digest("hex");
}

async function loadTauriConfig(configPath) {
  const payload = await readFile(configPath, "utf8");
  return JSON.parse(payload);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
