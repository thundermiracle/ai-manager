import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const libRs = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const appStateRs = readFileSync(
  new URL("../src-tauri/src/state/app_state.rs", import.meta.url),
  "utf8",
);
const commandContractRs = readFileSync(
  new URL("../src-tauri/src/contracts/command.rs", import.meta.url),
  "utf8",
);
const tsClient = readFileSync(new URL("../src/backend/client.ts", import.meta.url), "utf8");
const tsContracts = readFileSync(new URL("../src/backend/contracts.ts", import.meta.url), "utf8");

test("backend exposes detect/list/mutate commands through one invoke handler", () => {
  assert.match(
    libRs,
    /generate_handler!\[\s*detect_clients,\s*list_resources,\s*mutate_resource\s*\]/s,
  );
});

test("app state container includes deterministic lifecycle and operation tracking", () => {
  assert.match(appStateRs, /struct AppState/);
  assert.match(appStateRs, /lifecycle: RwLock<LifecycleSnapshot>/);
  assert.match(appStateRs, /operation_counter: AtomicU64/);
  assert.match(appStateRs, /pub fn mark_shutdown_requested\(&self\)/);
  assert.match(appStateRs, /pub fn next_operation_id\(&self, command_name: &str\) -> String/);
});

test("shared command envelope contract is standardized", () => {
  assert.match(commandContractRs, /pub struct CommandEnvelope<T>/);
  assert.match(commandContractRs, /pub ok: bool/);
  assert.match(commandContractRs, /pub data: Option<T>/);
  assert.match(commandContractRs, /pub error: Option<CommandError>/);
  assert.match(commandContractRs, /pub meta: CommandMeta/);
});

test("frontend typed client maps one-to-one to backend commands", () => {
  assert.match(tsClient, /invoke\("detect_clients", \{ request \}\)/);
  assert.doesNotMatch(tsClient, /install_client/);
  assert.match(tsClient, /invoke\("list_resources", \{ request \}\)/);
  assert.match(tsClient, /invoke\("mutate_resource", \{ request \}\)/);
});

test("frontend contracts include shared wrapper and command-specific requests", () => {
  assert.match(tsContracts, /export interface CommandEnvelope<T>/);
  assert.match(tsContracts, /export interface DetectClientsRequest/);
  assert.match(tsContracts, /confidence: number/);
  assert.doesNotMatch(tsContracts, /export interface InstallClientRequest/);
  assert.doesNotMatch(tsContracts, /install_guide_url/);
  assert.match(tsContracts, /export interface ListResourcesRequest/);
  assert.match(tsContracts, /export interface MutateResourceRequest/);
});
