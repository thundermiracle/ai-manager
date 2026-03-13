import type { ClientKind } from "../src/backend/contracts.ts";
import { toggleClientFilterSelection } from "../src/features/clients/client-filter-selection.ts";

const CLIENTS: readonly ClientKind[] = ["claude_code", "cursor", "codex"];

test("client filter selection allows clearing all chips", () => {
  expect(toggleClientFilterSelection(["cursor"], "cursor", CLIENTS)).toEqual([]);
});

test("client filter selection restores the canonical chip order", () => {
  expect(toggleClientFilterSelection(["cursor"], "claude_code", CLIENTS)).toEqual([
    "claude_code",
    "cursor",
  ]);
  expect(toggleClientFilterSelection(["claude_code", "cursor"], "codex", CLIENTS)).toEqual([
    "claude_code",
    "cursor",
    "codex",
  ]);
});
