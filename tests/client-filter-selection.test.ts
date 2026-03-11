import assert from "node:assert/strict";
import test from "node:test";

import type { ClientKind } from "../src/backend/contracts.ts";
import { toggleClientFilterSelection } from "../src/features/clients/client-filter-selection.ts";

const CLIENTS: readonly ClientKind[] = ["claude_code", "cursor", "codex"];

test("client filter selection allows clearing all chips", () => {
  assert.deepEqual(toggleClientFilterSelection(["cursor"], "cursor", CLIENTS), []);
});

test("client filter selection restores the canonical chip order", () => {
  assert.deepEqual(toggleClientFilterSelection(["cursor"], "claude_code", CLIENTS), [
    "claude_code",
    "cursor",
  ]);
  assert.deepEqual(toggleClientFilterSelection(["claude_code", "cursor"], "codex", CLIENTS), [
    "claude_code",
    "cursor",
    "codex",
  ]);
});
