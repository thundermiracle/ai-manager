import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const rustToolchain = readFileSync(new URL("../rust-toolchain.toml", import.meta.url), "utf8");

test("ci workflow defines separate web and rust quality jobs", () => {
  assert.match(ciWorkflow, /^\s{2}web-quality:/m);
  assert.match(ciWorkflow, /^\s{2}rust-quality:/m);
  assert.match(ciWorkflow, /run: pnpm run ci:web/);
  assert.match(ciWorkflow, /run: pnpm run ci:rust/);
});

test("ci workflow installs node and rust toolchains deterministically", () => {
  assert.match(ciWorkflow, /node-version: 24/);
  assert.match(ciWorkflow, /uses: dtolnay\/rust-toolchain@stable/);
  assert.match(ciWorkflow, /components: rustfmt, clippy/);
});

test("package scripts expose ci entry points for local reproduction", () => {
  assert.equal(typeof packageJson.scripts["ci:web"], "string");
  assert.equal(typeof packageJson.scripts["ci:rust"], "string");
  assert.equal(typeof packageJson.scripts.ci, "string");
});

test("rust toolchain file pins baseline channel and required components", () => {
  assert.match(rustToolchain, /^channel = "stable"$/m);
  assert.match(rustToolchain, /^components = \["clippy", "rustfmt"\]$/m);
});
