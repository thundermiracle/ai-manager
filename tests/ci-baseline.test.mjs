import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const rustToolchain = readFileSync(new URL("../rust-toolchain.toml", import.meta.url), "utf8");

function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function assertIncludesAll(text, tokens, label) {
  const normalizedText = normalize(text);
  for (const token of tokens) {
    assert.ok(
      normalizedText.includes(normalize(token)),
      `${label} is missing required token: ${token}`,
    );
  }
}

function parseWorkflowJobs(workflowText) {
  const lines = workflowText.split("\n");
  const jobs = new Map();
  let inJobsSection = false;
  let currentJob = null;
  let currentLines = [];

  for (const line of lines) {
    if (!inJobsSection) {
      if (/^jobs:\s*$/.test(line)) {
        inJobsSection = true;
      }
      continue;
    }

    const jobMatch = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (jobMatch) {
      if (currentJob !== null) {
        jobs.set(currentJob, currentLines.join("\n"));
      }
      currentJob = jobMatch[1];
      currentLines = [];
      continue;
    }

    if (/^[A-Za-z0-9_-]+:\s*$/.test(line)) {
      if (currentJob !== null) {
        jobs.set(currentJob, currentLines.join("\n"));
      }
      break;
    }

    if (currentJob !== null) {
      currentLines.push(line);
    }
  }

  if (currentJob !== null && !jobs.has(currentJob)) {
    jobs.set(currentJob, currentLines.join("\n"));
  }

  return jobs;
}

test("ci workflow defines separate web and rust quality jobs", () => {
  const jobs = parseWorkflowJobs(ciWorkflow);

  assert.ok(jobs.has("web-quality"));
  assert.ok(jobs.has("rust-quality"));

  assertIncludesAll(jobs.get("web-quality"), ["run: pnpm run ci:web"], "web-quality job");
  assertIncludesAll(jobs.get("rust-quality"), ["run: pnpm run ci:rust"], "rust-quality job");
});

test("ci workflow installs node and rust toolchains deterministically", () => {
  const jobs = parseWorkflowJobs(ciWorkflow);

  for (const jobName of ["web-quality", "rust-quality"]) {
    const jobDefinition = jobs.get(jobName);
    assert.ok(jobDefinition, `missing job definition: ${jobName}`);
    assertIncludesAll(
      jobDefinition,
      ["uses: actions/setup-node@v4", "node-version: 24"],
      `${jobName} node setup`,
    );
  }

  const rustJob = jobs.get("rust-quality");
  assert.ok(rustJob, "missing rust-quality job definition");
  assertIncludesAll(
    rustJob,
    ["uses: dtolnay/rust-toolchain@stable", "components:", "clippy", "rustfmt"],
    "rust-quality toolchain setup",
  );
});

test("package scripts expose ci entry points for local reproduction", () => {
  assert.equal(typeof packageJson.scripts["ci:web"], "string");
  assert.equal(typeof packageJson.scripts["ci:rust"], "string");
  assert.equal(typeof packageJson.scripts.ci, "string");
});

test("rust toolchain file pins baseline channel and required components", () => {
  assertIncludesAll(rustToolchain, ['channel = "stable"'], "rust-toolchain channel");

  const componentsMatch = rustToolchain.match(/components\s*=\s*\[([^\]]*)\]/m);
  assert.ok(componentsMatch, "rust-toolchain must declare components");

  const declaredComponents = componentsMatch[1]
    .split(",")
    .map((token) => token.trim().replaceAll('"', ""))
    .filter(Boolean);
  const declaredSet = new Set(declaredComponents);

  assert.ok(declaredSet.has("clippy"), "rust-toolchain components must include clippy");
  assert.ok(declaredSet.has("rustfmt"), "rust-toolchain components must include rustfmt");
});
