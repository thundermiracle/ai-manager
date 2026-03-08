import assert from "node:assert/strict";
import test from "node:test";

import { RESOURCE_KIND_CATALOG } from "../src/backend/contracts.ts";
import { listNativeResourceEntryPoints } from "../src/features/skills/native-resource-catalog.ts";
import {
  buildSkillContextHint,
  describeSkillAction,
} from "../src/features/skills/skill-context.ts";

test("project mode hint stays explicit about personal-only skill storage", () => {
  assert.match(buildSkillContextHint("project"), /generic skill libraries/i);
  assert.match(buildSkillContextHint("project"), /subagents/i);
});

test("personal mode hint stays concise", () => {
  assert.equal(
    buildSkillContextHint("personal"),
    "This tab manages AI Manager generic skill libraries for the selected client.",
  );
});

test("skill action labels stay explicit", () => {
  assert.equal(describeSkillAction("add"), "Add personal skill");
  assert.equal(describeSkillAction("update"), "Update personal skill");
  assert.equal(describeSkillAction("remove"), "Remove from personal");
  assert.equal(describeSkillAction("copy"), "Copy to another client");
  assert.equal(describeSkillAction("import"), "Import to personal skills");
});

test("resource kind catalog marks generic and native families explicitly", () => {
  assert.equal(RESOURCE_KIND_CATALOG.skill.family, "generic");
  assert.equal(RESOURCE_KIND_CATALOG.skill.managementModel, "ai_manager");
  assert.equal(RESOURCE_KIND_CATALOG.mcp.family, "native");
  assert.equal(RESOURCE_KIND_CATALOG.subagent.family, "native");
});

test("native resource entry points preview Claude-only native surfaces", () => {
  assert.equal(listNativeResourceEntryPoints("claude_code").length, 1);
  assert.match(
    listNativeResourceEntryPoints("claude_code")[0].description,
    /native Claude agent manifests/i,
  );
  assert.deepEqual(listNativeResourceEntryPoints("cursor"), []);
});
