import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const contractPath = new URL("../docs/spec/error-ui-contract.v1.json", import.meta.url);
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const expectedCategoryOrder = ["parse", "permission", "validation", "conflict", "io", "unknown"];
const expectedFlowOrder = ["detection", "read", "write"];
const stateNames = new Set([
  "idle",
  "loading",
  "success_full",
  "success_empty",
  "success_partial",
  "error",
]);

test("contract envelope and flow/category counts are fixed", () => {
  assert.equal(contract.version, "1.0.0");
  assert.equal(contract.errorCategories.length, expectedCategoryOrder.length);
  assert.equal(contract.flowContracts.length, expectedFlowOrder.length);
  assert.deepEqual(
    contract.errorCategories.map((category) => category.category),
    expectedCategoryOrder,
  );
  assert.deepEqual(
    contract.flowContracts.map((flow) => flow.flow),
    expectedFlowOrder,
  );
});

test("every category has canonical code, contextual message, and actionable suggestions", () => {
  const codePattern = /^AM_[A-Z]+_[0-9]{3}$/;

  for (const category of contract.errorCategories) {
    assert.match(category.canonicalCode, codePattern);
    assert.ok(category.messagePattern.includes("{resource}"));
    assert.equal(category.nonActionable, false);
    assert.ok(category.suggestedActions.length > 0);

    for (const actionId of category.suggestedActions) {
      assert.ok(contract.actionCatalog[actionId], `missing action definition: ${actionId}`);
    }
  }
});

test("disallowed generic phrases are not present in canonical category messages", () => {
  const disallowedPhrases = contract.genericErrorPolicy.disallowedMessagePhrases.map((phrase) =>
    phrase.toLowerCase(),
  );

  for (const category of contract.errorCategories) {
    const message = category.messagePattern.toLowerCase();

    for (const phrase of disallowedPhrases) {
      assert.equal(
        message.includes(phrase),
        false,
        `category ${category.category} contains disallowed phrase: ${phrase}`,
      );
    }
  }
});

test("all transitions are deterministic and target known states", () => {
  for (const flow of contract.flowContracts) {
    const seenEdges = new Set();

    assert.ok(stateNames.has(flow.initialState), `${flow.flow} has unknown initial state`);

    for (const state of flow.terminalStates) {
      assert.ok(stateNames.has(state), `${flow.flow} has unknown terminal state: ${state}`);
    }

    for (const transition of flow.transitions) {
      assert.ok(stateNames.has(transition.from), `${flow.flow} unknown from state`);
      assert.ok(stateNames.has(transition.to), `${flow.flow} unknown to state`);

      const edgeKey = `${transition.from}:${transition.event}`;
      assert.equal(seenEdges.has(edgeKey), false, `${flow.flow} has duplicate edge: ${edgeKey}`);
      seenEdges.add(edgeKey);
    }
  }
});

test("outcome mappings and error mappings are complete for each flow", () => {
  for (const flow of contract.flowContracts) {
    for (const state of Object.values(flow.outcomeToState)) {
      assert.ok(stateNames.has(state), `${flow.flow} has unknown outcome state: ${state}`);
    }

    assert.equal(flow.outcomeToState.partial, "success_partial");

    assert.deepEqual(Object.keys(flow.errorCategoryToState), expectedCategoryOrder);

    for (const [category, state] of Object.entries(flow.errorCategoryToState)) {
      assert.ok(expectedCategoryOrder.includes(category), `${flow.flow} unknown category: ${category}`);
      assert.equal(state, "error", `${flow.flow}/${category} must map to error state`);
    }
  }
});
