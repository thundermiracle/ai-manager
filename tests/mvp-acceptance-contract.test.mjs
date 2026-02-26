import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const contractPath = new URL("../docs/spec/mvp-acceptance-contract.v1.json", import.meta.url);
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const expectedFlows = ["detection", "list", "add", "remove"];

test("contract envelope and flow coverage are fixed", () => {
  assert.equal(contract.version, "1.0.0");
  assert.deepEqual(contract.flows, expectedFlows);
  assert.equal(contract.doneDefinitions.length, expectedFlows.length);
});

test("release policy is deterministic for go/no-go decisions", () => {
  assert.equal(contract.releaseDecisionPolicy.rule, "all_blocking_items_pass");
  assert.equal(contract.releaseDecisionPolicy.goState, "go");
  assert.equal(contract.releaseDecisionPolicy.noGoState, "no_go");
  assert.ok(contract.releaseDecisionPolicy.requiredEvidence.includes("automated_test"));
  assert.ok(contract.releaseDecisionPolicy.requiredEvidence.includes("manual_qa"));
  assert.ok(contract.releaseDecisionPolicy.requiredEvidence.includes("spec_review"));
});

test("must-have checklist covers all flows with blocking requirements", () => {
  const flowToChecklistCount = new Map(expectedFlows.map((flow) => [flow, 0]));

  for (const item of contract.mustHaveChecklist) {
    assert.equal(item.blocking, true, `checklist item must be blocking: ${item.id}`);
    flowToChecklistCount.set(item.flow, flowToChecklistCount.get(item.flow) + 1);
  }

  for (const [flow, count] of flowToChecklistCount.entries()) {
    assert.ok(count >= 2, `flow ${flow} must have at least two checklist items`);
  }
});

test("done definitions reference existing checklist items", () => {
  const checklistIds = new Set(contract.mustHaveChecklist.map((item) => item.id));

  for (const done of contract.doneDefinitions) {
    assert.ok(expectedFlows.includes(done.flow), `unknown flow in done definition: ${done.flow}`);
    assert.ok(done.doneWhen.length >= 2, `${done.flow} requires explicit done conditions`);
    assert.ok(done.notDoneWhen.length >= 1, `${done.flow} requires explicit not-done triggers`);

    for (const checklistId of done.requiredChecklistItemIds) {
      assert.ok(
        checklistIds.has(checklistId),
        `done definition references unknown checklist id: ${checklistId}`,
      );
    }
  }
});

test("non-goals are explicitly deferred to later implementation issues", () => {
  const seenNonGoalIds = new Set();

  for (const nonGoal of contract.nonGoals) {
    assert.equal(seenNonGoalIds.has(nonGoal.id), false, `duplicate non-goal id: ${nonGoal.id}`);
    seenNonGoalIds.add(nonGoal.id);
    assert.ok(nonGoal.deferredToIssues.length >= 1, `${nonGoal.id} must reference deferred issues`);

    for (const issueNumber of nonGoal.deferredToIssues) {
      assert.ok(
        issueNumber > 13,
        `${nonGoal.id} must point to an issue later than #13, got #${issueNumber}`,
      );
    }
  }
});
