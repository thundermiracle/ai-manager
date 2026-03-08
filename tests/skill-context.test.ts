import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSkillContextHint,
  describeSkillAction,
} from "../src/features/skills/skill-context.ts";

test("project mode hint stays explicit about personal-only skill storage", () => {
  assert.match(buildSkillContextHint("project"), /personal skill storage/i);
  assert.match(buildSkillContextHint("project"), /not available yet/i);
});

test("personal mode hint stays concise", () => {
  assert.equal(
    buildSkillContextHint("personal"),
    "Skills are managed in the selected client's personal storage.",
  );
});

test("skill action labels stay explicit", () => {
  assert.equal(describeSkillAction("add"), "Add personal skill");
  assert.equal(describeSkillAction("update"), "Update personal skill");
  assert.equal(describeSkillAction("remove"), "Remove from personal");
  assert.equal(describeSkillAction("copy"), "Copy to another client");
  assert.equal(describeSkillAction("import"), "Import to personal skills");
});
