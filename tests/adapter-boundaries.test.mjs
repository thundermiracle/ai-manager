import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const domainAdapterPort = readFileSync(
  new URL("../src-tauri/src/domain/client_adapter.rs", import.meta.url),
  "utf8",
);
const adapterRegistry = readFileSync(
  new URL("../src-tauri/src/infra/adapter_registry.rs", import.meta.url),
  "utf8",
);
const adapterService = readFileSync(
  new URL("../src-tauri/src/application/adapter_service.rs", import.meta.url),
  "utf8",
);
const detectorInterface = readFileSync(
  new URL("../src-tauri/src/detection/client_detector.rs", import.meta.url),
  "utf8",
);
const detectorRegistry = readFileSync(
  new URL("../src-tauri/src/detection/detector_registry.rs", import.meta.url),
  "utf8",
);
const detectContract = readFileSync(
  new URL("../src-tauri/src/contracts/detect.rs", import.meta.url),
  "utf8",
);
const detectCommand = readFileSync(
  new URL("../src-tauri/src/commands/detect.rs", import.meta.url),
  "utf8",
);
const architectureDoc = readFileSync(
  new URL("../docs/architecture/module-boundaries.md", import.meta.url),
  "utf8",
);

test("domain exposes adapter interface independent from concrete clients", () => {
  assert.match(domainAdapterPort, /pub trait ClientAdapter: Send \+ Sync/);
  assert.match(
    domainAdapterPort,
    /fn list_resources\(&self, resource_kind: ResourceKind\) -> AdapterListResult/,
  );
  assert.match(
    domainAdapterPort,
    /fn mutate_resource\(&self, action: MutationAction, target_id: &str\) -> AdapterMutationResult/,
  );
});

test("infra registry wires exactly the four current client adapters", () => {
  assert.match(adapterRegistry, /Box::new\(ClaudeCodeAdapter::new\(\)\)/);
  assert.match(adapterRegistry, /Box::new\(CodexCliAdapter::new\(\)\)/);
  assert.match(adapterRegistry, /Box::new\(CursorAdapter::new\(\)\)/);
  assert.match(adapterRegistry, /Box::new\(CodexAppAdapter::new\(\)\)/);
});

test("application service is the orchestration boundary consumed by commands", () => {
  assert.match(adapterService, /pub struct AdapterService<'a>/);
  assert.match(adapterService, /pub fn detect_clients\(&self, request: DetectClientsRequest\)/);
  assert.match(
    detectCommand,
    /let service = AdapterService::new\(state.adapter_registry\(\), state.detector_registry\(\)\);/,
  );
});

test("detector framework shares one interface and output schema", () => {
  assert.match(detectorInterface, /pub trait ClientDetector: Send \+ Sync/);
  assert.match(detectorRegistry, /Box::new\(ClaudeCodeDetector::new\(\)\)/);
  assert.match(detectorRegistry, /Box::new\(CodexCliDetector::new\(\)\)/);
  assert.match(detectorRegistry, /Box::new\(CursorDetector::new\(\)\)/);
  assert.match(detectorRegistry, /Box::new\(CodexAppDetector::new\(\)\)/);
  assert.match(detectContract, /pub status: DetectionStatus/);
  assert.match(detectContract, /pub confidence: u8/);
  assert.match(detectContract, /pub evidence: DetectionEvidence/);
});

test("architecture doc explains the layer split and extension rule", () => {
  assert.match(architectureDoc, /domain\//);
  assert.match(architectureDoc, /adapters\//);
  assert.match(architectureDoc, /infra\//);
  assert.match(architectureDoc, /application\//);
  assert.match(architectureDoc, /To add a new client adapter/);
});
